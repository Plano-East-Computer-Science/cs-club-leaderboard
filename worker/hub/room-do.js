/**
 * One Durable Object per meeting room. It holds the live quiz and the pulse
 * meter, and fans changes out to every connected phone over WebSockets.
 *
 * Uses the hibernation API: idle rooms cost nothing, and state is written to
 * storage so a room survives eviction mid-meeting.
 *
 * The Worker authenticates before forwarding and passes identity in headers
 * (x-role / x-uid / x-name); the DO is not reachable any other way.
 */
import { newDuel, setDivision, startRound, submit, everyoneSolved, endRound, pickSpotlight, finish, duelView, DIVISIONS } from './duel.js';
import { makePairs, groupKeys } from './pairs.js';
import { duelActivities } from './duel-awards.js';
import { awardFromUser } from './award.js';

const PULSE = ['fast', 'slow', 'lost', 'great'];
const MAX_CODE = 20_000;

const fresh = () => ({
  q: null, // { id, text, options, correct, seconds, openedAt, open, revealed }
  answers: {}, // uid -> { choice, ms }
  scores: {}, // uid -> { name, pts }
  pulse: {}, // uid -> one of PULSE
  names: {}, // uid -> name (everyone who has connected)
  stage: [], // today's agenda: [{ label, url }] the host pins for everyone
  asks: [], // question box: [{ id, uid, text }], only the host sees it
  duel: null, // B2, see duel.js
  pairs: null, // B9: [[uid, uid], ...] from "pair the room"
  pairAvoid: [], // last pairs, so the next press rotates
  code: '', // the room code, for duel_results
  ended: false,
  seq: 0,
});

/** Agenda links: a label plus a page on this site ("/learn/...") or an https URL. Nothing else. */
export function cleanStage(items) {
  return (Array.isArray(items) ? items : [])
    .map((it) => ({ label: String(it?.label ?? '').trim().slice(0, 60), url: String(it?.url ?? '').trim().slice(0, 300) }))
    .filter((it) => it.label && (/^\/[^/\\]/.test(it.url) || /^https:\/\/\S+$/.test(it.url)))
    .slice(0, 8);
}

export class Room {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.s = fresh();
    ctx.blockConcurrencyWhile(async () => {
      this.s = (await ctx.storage.get('s')) ?? fresh();
    });
  }

  async save() {
    await this.ctx.storage.put('s', this.s);
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 426 });

    const role = request.headers.get('x-role') === 'host' ? 'host' : 'student';
    const uid = role === 'host' ? 'host' : String(request.headers.get('x-uid') ?? '');
    const name = request.headers.get('x-name') || 'Student';
    const code = request.headers.get('x-code');
    if (code && !this.s.code) this.s.code = code;

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ role, uid, name });

    if (role === 'student') {
      this.s.names[uid] = name;
      this.s.scores[uid] ??= { name, pts: 0 };
      await this.save();
    }
    this.broadcast();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    let m;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    const { role, uid } = ws.deserializeAttachment() ?? {};
    const s = this.s;

    if (role === 'host') {
      if (m.t === 'ask') {
        const options = (m.options ?? []).map((o) => String(o).slice(0, 120)).filter(Boolean).slice(0, 6);
        if (!m.text || options.length < 2) return;
        const seconds = Math.min(Math.max(Number(m.seconds) || 20, 5), 120);
        const correct = Number.isInteger(m.correct) && m.correct >= 0 && m.correct < options.length ? m.correct : null;
        s.q = {
          id: ++s.seq,
          text: String(m.text).slice(0, 300),
          options,
          correct,
          seconds,
          openedAt: Date.now(),
          open: true,
          revealed: false,
        };
        s.answers = {};
        await this.schedule();
      } else if (m.t === 'close' && s.q?.open) {
        this.closeQuestion();
      } else if (m.t === 'reveal' && s.q) {
        if (s.q.open) this.closeQuestion();
        s.q.revealed = true;
      } else if (m.t === 'stage') {
        s.stage = cleanStage(m.items);
      } else if (m.t === 'ask_done') {
        s.asks = (s.asks ?? []).filter((a) => a.id !== m.id);
      } else if (m.t === 'clear_pulse') {
        s.pulse = {};
      } else if (m.t === 'end') {
        s.ended = true;
        s.q = s.q && { ...s.q, open: false };
        if (s.duel?.phase === 'live') await this.closeRound();
      } else if (m.t === 'pairs') {
        // B9: pair everyone connected; remembers this set so the next press rotates.
        const mode = ['random', 'mixed', 'squad'].includes(m.mode) ? m.mode : 'random';
        const levels = Object.fromEntries(Object.entries(s.duel?.divs ?? {}).map(([u, d]) => [u, DIVISIONS.indexOf(d)]));
        s.pairs = makePairs(this.present(), { mode, levels, avoid: s.pairAvoid ?? [] });
        s.pairAvoid = groupKeys(s.pairs);
      } else if (m.t === 'pairs_clear') {
        s.pairs = null;
      } else if (typeof m.t === 'string' && m.t.startsWith('duel_')) {
        const err = await this.hostDuel(m);
        if (err) return this.notice(ws, err);
      } else return;
    } else if (role === 'student') {
      if (m.t === 'answer' && s.q?.open && !(uid in s.answers)) {
        const choice = Number(m.choice);
        if (!Number.isInteger(choice) || choice < 0 || choice >= s.q.options.length) return;
        s.answers[uid] = { choice, ms: Date.now() - s.q.openedAt };
      } else if (m.t === 'pulse' && PULSE.includes(m.v)) {
        s.pulse[uid] = m.v;
      } else if (m.t === 'question') {
        const text = String(m.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
        s.asks ??= [];
        // A few open questions each, so one phone cannot flood the host.
        if (text.length < 3 || s.asks.filter((a) => a.uid === uid).length >= 3 || s.asks.length >= 60) return;
        s.asks.push({ id: ++s.seq, uid, text });
      } else if (m.t === 'duel_div' && s.duel) {
        const r = setDivision(s.duel, uid, m.div);
        if (r.error) return this.notice(ws, r.error);
      } else if (m.t === 'duel_submit' && s.duel) {
        const r = submit(s.duel, uid, { round: m.round, slug: m.slug, passed: m.passed === true }, Date.now());
        if (r.error) return this.notice(ws, r.error);
        // Kept per round and student, outside the main state: code can be large.
        await this.ctx.storage.put(`code:${s.duel.round}:${uid}`, String(m.code ?? '').slice(0, MAX_CODE));
        if (everyoneSolved(s.duel)) await this.closeRound();
      } else return;
    }

    await this.save();
    this.broadcast();
  }

  webSocketClose(ws) {
    ws.close();
    this.broadcast();
  }

  async alarm() {
    const now = Date.now();
    let changed = false;
    if (this.s.q?.open && now >= this.s.q.openedAt + this.s.q.seconds * 1000 - 50) {
      this.closeQuestion();
      changed = true;
    }
    if (this.s.duel?.phase === 'live' && now >= this.s.duel.endsAt - 50) {
      await this.closeRound();
      changed = true;
    }
    await this.schedule();
    if (changed) {
      await this.save();
      this.broadcast();
    }
  }

  /** One alarm serves both timers (quiz question, duel round): set it to whichever ends first. */
  async schedule() {
    const due = [];
    if (this.s.q?.open) due.push(this.s.q.openedAt + this.s.q.seconds * 1000);
    if (this.s.duel?.phase === 'live') due.push(this.s.duel.endsAt);
    if (due.length) await this.ctx.storage.setAlarm(Math.min(...due));
  }

  /** uids of students connected right now. */
  present() {
    const ids = this.ctx.getWebSockets().map((w) => w.deserializeAttachment()).filter((a) => a?.role === 'student').map((a) => a.uid);
    return [...new Set(ids)];
  }

  /** A message for one screen only: why their action was refused. */
  notice(ws, text) {
    try {
      ws.send(JSON.stringify({ t: 'notice', text }));
    } catch {
      /* socket already gone */
    }
  }

  /** Host duel controls. Returns an error sentence, or nothing on success. */
  async hostDuel(m) {
    const s = this.s;
    const db = this.env?.DB;
    if (m.t === 'duel_setup') {
      if (s.duel && s.duel.phase !== 'done') return 'A duel is already running. Close it first.';
      const asked = Object.fromEntries(DIVISIONS.map((d) => [d, (Array.isArray(m.problems?.[d]) ? m.problems[d] : []).map(String).slice(0, 3)]));
      const slugs = [...new Set(Object.values(asked).flat())];
      if (!slugs.length) return 'Pick at least one problem.';
      // Only live problems from the bank; titles come from there, not from the message.
      const rows = (
        await db.prepare(`SELECT slug, title FROM problems WHERE status = 'live' AND slug IN (${slugs.map(() => '?').join(',')})`).bind(...slugs).all()
      ).results;
      const title = Object.fromEntries(rows.map((r) => [r.slug, r.title]));
      const problems = Object.fromEntries(DIVISIONS.map((d) => [d, asked[d].filter((x) => x in title).map((slug) => ({ slug, title: title[slug] }))]));
      const r = newDuel({ problems, minutes: m.minutes ?? 10, rounds: m.rounds ?? 3, newMode: m.newMode });
      if (r.error) return r.error;
      // Keep who picked which division last time, so the room does not pick again.
      if (s.duel) r.duel.divs = Object.fromEntries(Object.entries(s.duel.divs).filter(([, d]) => r.duel.problems[d]?.length));
      s.duel = r.duel;
    } else if (!s.duel) {
      return 'Set up a duel first.';
    } else if (m.t === 'duel_start') {
      const slugs = DIVISIONS.flatMap((d) => s.duel.problems[d].map((p) => p.slug));
      // The ghost is the best time anyone has had on that problem, in any room.
      const ghostTimes = {};
      if (db && slugs.length) {
        const rows = (
          await db
            .prepare(`SELECT slug, MIN(solved_ms) AS ms FROM duel_results WHERE solved_ms IS NOT NULL AND slug IN (${slugs.map(() => '?').join(',')}) GROUP BY slug`)
            .bind(...slugs)
            .all()
        ).results;
        for (const r of rows) ghostTimes[r.slug] = r.ms;
      }
      const r = startRound(s.duel, { now: Date.now(), present: this.present(), ghostTimes });
      if (r.error) return r.error;
      await this.schedule();
    } else if (m.t === 'duel_end_round') {
      if (s.duel.phase !== 'live') return 'No round is running.';
      await this.closeRound();
    } else if (m.t === 'duel_spotlight') {
      const r = pickSpotlight(s.duel, m.uid);
      if (r.error) return r.error;
    } else if (m.t === 'duel_finish') {
      const r = finish(s.duel);
      if (r.error) return r.error;
    } else if (m.t === 'duel_close') {
      if (s.duel.phase === 'live') return 'End the round first.';
      s.duel = null;
    } else {
      return 'Unknown duel command.';
    }
    return null;
  }

  /** Ends the live round and writes its results, with each student's last code, to D1. */
  async closeRound() {
    const s = this.s;
    const r = endRound(s.duel, Date.now());
    if (r.error || !r.rows.length) return;
    const db = this.env?.DB;
    if (!db) return;
    const codes = await this.ctx.storage.get(r.rows.map((x) => `code:${x.round}:${x.user_id}`));
    try {
      await db.batch(
        r.rows.map((x) =>
          db
            .prepare(
              `INSERT OR REPLACE INTO duel_results (room_code, round, division, match_no, user_id, slug, attempts, solved_ms, won, code)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(s.code || '?', x.round, x.division, x.match_no, Number(x.user_id), x.slug, x.attempts, x.solved_ms, x.won, codes.get(`code:${x.round}:${x.user_id}`) ?? '')
        )
      );
    } catch (err) {
      // The code stays in DO storage; only the D1 copy of this round is missing.
      console.error('duel_results write failed', err);
    }
    // Points through the ledger; `ref` is per room and round, so a replay never pays twice.
    const acts = duelActivities(r.rows.map((x) => ({ ...x, room_code: s.code || '?', user_id: Number(x.user_id) })));
    for (const act of acts) await awardFromUser(db, null, act);
  }

  /** Stops accepting answers and scores them: 500 for right, up to 500 more for speed. */
  closeQuestion() {
    const q = this.s.q;
    q.open = false;
    if (q.correct == null) return;
    for (const [uid, a] of Object.entries(this.s.answers)) {
      if (a.choice !== q.correct) continue;
      const frac = Math.max(0, 1 - a.ms / (q.seconds * 1000));
      const entry = (this.s.scores[uid] ??= { name: this.s.names[uid] ?? 'Student', pts: 0 });
      entry.pts += 500 + Math.round(500 * frac);
    }
  }

  view(role, uid) {
    const s = this.s;
    const live = this.ctx.getWebSockets().map((w) => w.deserializeAttachment()).filter((a) => a?.role === 'student');
    const connected = new Set(live.map((a) => a.uid));
    const q = s.q;

    const counts = q ? q.options.map((_, i) => Object.values(s.answers).filter((a) => a.choice === i).length) : [];
    const pulse = Object.fromEntries(PULSE.map((p) => [p, Object.values(s.pulse).filter((v) => v === p).length]));
    const board = Object.entries(s.scores)
      .map(([id, v]) => ({ name: v.name, pts: v.pts, you: id === uid }))
      .sort((a, b) => b.pts - a.pts)
      .slice(0, 10);

    const showAnswer = role === 'host' || q?.revealed;
    return {
      t: 'state',
      role,
      ended: s.ended,
      here: connected.size,
      answered: Object.keys(s.answers).length,
      pulse,
      board,
      stage: s.stage ?? [],
      asks: role === 'host' ? (s.asks ?? []).map((a) => ({ id: a.id, text: a.text, name: s.names[a.uid] ?? 'Student' })) : undefined,
      myAsks: role === 'student' ? (s.asks ?? []).filter((a) => a.uid === uid).length : undefined,
      duel: duelView(s.duel, { role, uid, names: s.names, present: [...connected] }),
      pairs:
        role === 'host'
          ? s.pairs?.map((g) => g.map((u) => s.names[u] ?? 'Student'))
          : s.pairs?.find((g) => g.includes(uid))?.filter((u) => u !== uid).map((u) => s.names[u] ?? 'Student'),
      q: q && {
        id: q.id,
        text: q.text,
        options: q.options,
        seconds: q.seconds,
        openedAt: q.openedAt,
        open: q.open,
        revealed: q.revealed,
        correct: showAnswer ? q.correct : null,
        // Distribution is shown once the question is closed (or always to the host).
        counts: role === 'host' || !q.open ? counts : null,
        mine: role === 'student' && uid in s.answers ? s.answers[uid].choice : null,
      },
      now: Date.now(),
    };
  }

  broadcast() {
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (!a) continue;
      try {
        ws.send(JSON.stringify(this.view(a.role, a.uid)));
      } catch {
        /* socket already gone */
      }
    }
  }
}
