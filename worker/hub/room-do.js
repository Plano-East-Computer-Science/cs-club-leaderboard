/**
 * One Durable Object per meeting room. It holds the run-of-show (B1) and
 * everything live inside it: the quiz, the pulse meter, the agenda links, the
 * duel engine (B2), the team contest (B5, shared/contest.js), lab progress (B3), the show gallery (B6), the help queue
 * (B7) and speaker questions (B8). It fans changes out to every connected
 * screen over WebSockets.
 *
 * Uses the hibernation API: idle rooms cost nothing, and state is written to
 * storage so a room survives eviction mid-meeting.
 *
 * The Worker authenticates before forwarding and passes identity in headers
 * (x-role / x-uid / x-name, plus x-code / x-kind / x-template for the room);
 * the DO is not reachable any other way. Students only get here after a
 * check-in with the rotating token (B4, rooms.js).
 *
 * Exit artifacts (B4): the first thing a student does that counts (a poll
 * answer, a passed lab checkpoint, a duel attempt, a show artifact, helping
 * someone, a "what I did" line) is written to their room_checkins row.
 * Closing the room pays attendance to every check-in and the `active` bonus
 * to rows that have one (V3-A, rooms.js awardAttendance).
 */
import { newDuel, setDivision, startRound, submit, everyoneSolved, endRound, pickSpotlight, finish, duelView, findSide, DIVISIONS } from './duel.js';
import { makePairs, groupKeys } from './pairs.js';
import { duelActivities } from './duel-awards.js';
import { awardFromUser } from './award.js';
import { findCourse } from '../../shared/courses.js';
import * as S from './session.js';
import * as C from '../../shared/contest.js';
import { studentBlocks } from '../../shared/session-templates.js';

const PULSE = ['fast', 'slow', 'lost', 'great'];
const MAX_CODE = 20_000;

const fresh = () => ({
  q: null, // { id, text, options, correct, seconds, openedAt, open, revealed }
  answers: {}, // uid -> { choice, ms }
  scores: {}, // uid -> { name, pts }
  pulse: {}, // uid -> one of PULSE
  names: {}, // uid -> name (everyone who has connected)
  stage: [], // agenda links: [{ label, url }] the host pins for everyone
  session: null, // B1, see session.js
  help: [], // B7 help queue
  speaker: S.freshSpeaker(), // B8
  show: S.freshShow(), // B6
  labs: {}, // B3, per lab block id
  exits: {}, // B4: uid -> what counted as their exit artifact
  duelSolved: {}, // uid -> title of the last duel problem they solved, for the show block
  duel: null, // B2, see duel.js
  contest: null, // B5, see shared/contest.js
  pairs: null, // B9: [[uid, uid], ...] from "pair the room"
  pairAvoid: [], // last pairs, so the next press rotates
  code: '', // the room code, for D1 rows
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

/** Per tier of a lab block: the ordered checkpoint ids. Course tiers use their code steps. */
export function labCheckpoints(block) {
  return (block?.lab?.tiers ?? []).map((t) => {
    const [kind, rest = ''] = t.source.split(':');
    if (kind === 'course') return (findCourse(rest)?.steps ?? []).filter((s) => s.kind === 'code').map((s) => s.id);
    return rest.split(',').filter(Boolean);
  });
}

const first = (name) => String(name ?? '').trim().split(/\s+/)[0] || 'Someone';

export class Room {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.s = fresh();
    ctx.blockConcurrencyWhile(async () => {
      // Spread over fresh() so a room stored before a field existed still has it.
      this.s = { ...fresh(), ...((await ctx.storage.get('s')) ?? {}) };
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
    // The run-of-show comes from the template the officer picked when opening the room.
    let planned = null; // G1: blocks from a planned session, if this room was opened for one
    try { planned = JSON.parse(decodeURIComponent(request.headers.get('x-blocks') || 'null')); } catch { /* fall back to the template */ }
    this.s.session ??= S.newSession({ kind: request.headers.get('x-kind') || 'meeting', template: request.headers.get('x-template') || 'build', blocks: planned });

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ role, uid, name });

    if (role === 'student') {
      this.s.names[uid] = name;
      this.s.scores[uid] ??= { name, pts: 0 };
    }
    await this.save();
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
    s.session ??= S.newSession();
    const err = role === 'host' ? await this.hostMessage(m) : role === 'student' ? await this.studentMessage(uid, m) : 'skip';
    if (err === 'skip') return;
    if (err) return this.notice(ws, err);
    await this.save();
    this.broadcast();
  }

  /** Host controls. Returns an error sentence, 'skip' for an unknown message, or nothing. */
  async hostMessage(m) {
    const s = this.s;
    const now = Date.now();
    const sess = s.session;
    let r = null;
    switch (m.t) {
      case 'ask': {
        const options = (m.options ?? []).map((o) => String(o).slice(0, 120)).filter(Boolean).slice(0, 6);
        if (!m.text || options.length < 2) return 'A question needs text and two options.';
        const seconds = Math.min(Math.max(Number(m.seconds) || 20, 5), 120);
        const correct = Number.isInteger(m.correct) && m.correct >= 0 && m.correct < options.length ? m.correct : null;
        s.q = { id: ++s.seq, text: String(m.text).slice(0, 300), options, correct, seconds, openedAt: now, open: true, revealed: false };
        s.answers = {};
        await this.schedule();
        break;
      }
      case 'close':
        if (s.q?.open) this.closeQuestion();
        break;
      case 'reveal':
        if (!s.q) break;
        if (s.q.open) this.closeQuestion();
        s.q.revealed = true;
        break;
      case 'stage':
        s.stage = cleanStage(m.items);
        break;
      case 'clear_pulse':
        s.pulse = {};
        break;
      case 'end':
        s.ended = true;
        s.q = s.q && { ...s.q, open: false };
        if (s.duel?.phase === 'live') await this.closeRound();
        if (s.contest?.phase === 'live') C.endContest(s.contest);
        break;
      case 'pairs': {
        // B9: pair everyone connected; remembers this set so the next press rotates.
        const mode = ['random', 'mixed', 'squad'].includes(m.mode) ? m.mode : 'random';
        const levels = Object.fromEntries(Object.entries(s.duel?.divs ?? {}).map(([u, d]) => [u, DIVISIONS.indexOf(d)]));
        s.pairs = makePairs(this.present(), { mode, levels, avoid: s.pairAvoid ?? [] });
        s.pairAvoid = groupKeys(s.pairs);
        break;
      }
      case 'pairs_clear':
        s.pairs = null;
        break;
      // B1 run-of-show
      case 'block_go':
      case 'block_next':
      case 'block_prev': {
        const to = m.t === 'block_go' ? m.i : sess.cur + (m.t === 'block_next' ? 1 : -1);
        r = S.goTo(sess, to, now);
        // A poll belongs to its block: close it and clear it so later screens do not carry a stale question.
        if (!r?.error && s.q) {
          if (s.q.open) this.closeQuestion();
          s.q = null;
        }
        break;
      }
      case 'block_time':
        r = S.addTime(sess, m.minutes, now);
        break;
      case 'blocks_set':
        r = S.setBlocks(sess, m.blocks, now);
        break;
      // B7, B8, B6
      case 'help_clear':
        r = S.helpClose(s.help, m.id);
        break;
      case 'sq_answered':
        r = S.sqAnswered(s.speaker, m.id);
        break;
      case 'takeaways':
        s.speaker.takeaways = String(m.text ?? '').slice(0, 4000);
        await this.d1('UPDATE rooms SET takeaways = ? WHERE code = ?', s.speaker.takeaways, s.code);
        break;
      case 'show_pick': {
        r = S.showPick(s.show, m.id);
        const it = s.show.items.find((x) => x.id === Number(m.id));
        if (!r.error && s.show.picked.includes(it.id)) await this.d1('UPDATE artifacts SET shown = 1 WHERE room_code = ? AND user_id = ?', s.code, Number(it.uid));
        break;
      }
      default:
        if (typeof m.t === 'string' && m.t.startsWith('duel_')) return this.hostDuel(m);
        if (typeof m.t === 'string' && m.t.startsWith('contest_')) return this.hostContest(m);
        return 'skip';
    }
    return r?.error ?? null;
  }

  /** Student actions. Returns an error sentence, 'skip' for an unknown message, or nothing. */
  async studentMessage(uid, m) {
    const s = this.s;
    const block = S.currentBlock(s.session);
    const type = block?.type;
    let r = null;
    switch (m.t) {
      case 'answer': {
        if (!s.q?.open || uid in s.answers) return 'skip';
        const choice = Number(m.choice);
        if (!Number.isInteger(choice) || choice < 0 || choice >= s.q.options.length) return 'skip';
        s.answers[uid] = { choice, ms: Date.now() - s.q.openedAt };
        await this.exit(uid, 'poll');
        break;
      }
      case 'pulse':
        if (!PULSE.includes(m.v)) return 'skip';
        s.pulse[uid] = m.v;
        break;
      // B7: open in every block and in drop-ins.
      case 'help_ask':
        r = S.helpAsk(s.help, uid, m.topic, ++s.seq);
        break;
      case 'help_offer':
        r = S.helpOffer(s.help, uid, m.id);
        break;
      case 'help_cancel':
        r = S.helpClose(s.help, m.id, uid);
        break;
      case 'help_solve': {
        r = S.helpSolve(s.help, uid, m.id, m.helper);
        if (r.helper) {
          // The helper gets a mentor activity (pending officer approval by the rules); the ref makes it once only.
          await awardFromUser(this.env?.DB, null, {
            userId: Number(r.helper),
            kind: 'mentor',
            ref: `help:${s.code || '?'}:${Number(m.id)}`,
            meta: { title: `Helped ${first(s.names[uid])} in a meeting: ${r.topic}`.slice(0, 160), room: s.code },
          });
          await this.exit(r.helper, 'help');
        }
        break;
      }
      // B8
      case 'sq_ask':
        if (type !== 'speaker') return 'Questions open during the talk.';
        r = S.sqAsk(s.speaker, uid, m.text, ++s.seq);
        break;
      case 'sq_vote':
        r = S.sqVote(s.speaker, uid, m.id);
        break;
      // B6
      case 'show_submit': {
        if (type !== 'show') return 'Sharing opens in the show block.';
        r = S.showSubmit(s.show, uid, m, this.earned(uid), ++s.seq);
        if (r.error) break;
        const it = r.item;
        await this.d1(
          `INSERT INTO artifacts (room_code, user_id, kind, url, line, result) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(room_code, user_id) DO UPDATE SET kind = excluded.kind, url = excluded.url, line = excluded.line,
             result = excluded.result, kudos = 0, shown = 0, created_at = datetime('now')`,
          s.code,
          Number(uid),
          it.kind,
          it.url,
          it.line,
          it.result
        );
        await this.exit(uid, 'show');
        break;
      }
      case 'show_kudos':
        r = S.showKudos(s.show, uid, m.id);
        if (r.item) await this.d1('UPDATE artifacts SET kudos = ? WHERE room_code = ? AND user_id = ?', r.item.kudos.length, s.code, Number(r.item.uid));
        break;
      // B3
      case 'lab_tier':
        if (type !== 'lab') return 'The lab is not open.';
        r = S.labPick((s.labs[block.id] ??= S.freshLab()), uid, m.tier, block.lab.tiers);
        break;
      case 'lab_pass':
        if (type !== 'lab') return 'The lab is not open.';
        r = S.labPass((s.labs[block.id] ??= S.freshLab()), uid, m.step, labCheckpoints(block));
        if (r.ok) await this.exit(uid, 'lab');
        break;
      // B4: the one-line "what I did" on the close block (or any time in a drop-in).
      case 'note': {
        if (type !== 'close' && s.session.kind !== 'dropin') return 'The exit line opens at the close.';
        const text = String(m.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 140);
        if (text.length < 3) return 'Write one line about what you did.';
        await this.exit(uid, 'note', text);
        break;
      }
      case 'duel_div':
        if (!s.duel) return 'skip';
        r = setDivision(s.duel, uid, m.div);
        break;
      case 'duel_submit': {
        if (!s.duel) return 'skip';
        r = submit(s.duel, uid, { round: m.round, slug: m.slug, passed: m.passed === true }, Date.now());
        if (r.error) break;
        // Kept per round and student, outside the main state: code can be large.
        await this.ctx.storage.put(`code:${s.duel.round}:${uid}`, String(m.code ?? '').slice(0, MAX_CODE));
        await this.exit(uid, 'duel');
        // Remembered past this round, so it can be shown in a later show block.
        if (r.solved) s.duelSolved[uid] = findSide(s.duel, uid)?.match.title ?? 'a duel problem';
        if (everyoneSolved(s.duel)) await this.closeRound();
        break;
      }
      case 'contest_submit': {
        if (!s.contest) return 'skip';
        r = C.submit(s.contest, uid, { team: m.team, slug: m.slug, passed: m.passed === true }, Date.now());
        if (r.error) break;
        // Every attempt is kept with its code for officer spot-checks. The pass/fail came from the
        // member's browser (Pyodide), the same honour-system trust as duels: no server-side judge.
        const sub = s.contest.subs.at(-1);
        await this.d1(
          'INSERT INTO contest_attempts (room_code, team_id, user_id, slug, ok, ms, code) VALUES (?, ?, ?, ?, ?, ?, ?)',
          s.code || '?',
          r.team,
          Number(uid),
          sub.slug,
          sub.ok ? 1 : 0,
          sub.ms,
          String(m.code ?? '').slice(0, MAX_CODE)
        );
        await this.exit(uid, 'contest'); // playing a contest is this member's exit artifact for attendance
        break;
      }
      default:
        return 'skip';
    }
    return r?.error ?? null;
  }

  /** What this student can put in the show block as a result: { lab, duel } descriptions or null. */
  earned(uid) {
    const s = this.s;
    let lab = null;
    for (const [bid, l] of Object.entries(s.labs)) {
      const n = (l.passed[uid] ?? []).length;
      const blk = s.session.blocks.find((x) => x.id === bid);
      if (n) lab = `Passed ${n} checkpoint${n === 1 ? '' : 's'}${blk ? ` in ${blk.title}` : ''}`;
    }
    const duel = s.duelSolved[uid] ? `Solved ${s.duelSolved[uid]} in a duel` : null;
    return { lab, duel };
  }

  /** B4: records the first exit artifact (a note always replaces an earlier note). Never throws. */
  async exit(uid, kind, note = null) {
    const s = this.s;
    if (s.exits[uid] && !note) return;
    s.exits[uid] ??= kind;
    await this.d1(
      'UPDATE room_checkins SET exit_kind = COALESCE(exit_kind, ?), exit_note = COALESCE(?, exit_note) WHERE code = ? AND user_id = ?',
      kind,
      note,
      s.code,
      Number(uid)
    );
  }

  /** One D1 write that must not break the live room if it fails. */
  async d1(sql, ...args) {
    const db = this.env?.DB;
    if (!db) return;
    try {
      await db.prepare(sql).bind(...args).run();
    } catch (err) {
      console.error('room d1 write failed', err?.message ?? err);
    }
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
    if (this.s.contest?.phase === 'live') {
      // The freeze moment changes what every screen shows; the end closes submissions.
      // STUB: placing in a mock contest pays nothing yet. If officers decide it should, award `place`
      // through awardFromUser here from C.rank(C.scoreRows(contest)) with ref `contest:<room>:<team>`.
      if (now >= this.s.contest.endsAt - 50) C.endContest(this.s.contest);
      changed = true;
    }
    await this.schedule();
    if (changed) {
      await this.save();
      this.broadcast();
    }
  }

  /** One alarm serves both timers (quiz question, duel round): set it to whichever ends first. Block timers never act. */
  async schedule() {
    const due = [];
    if (this.s.q?.open) due.push(this.s.q.openedAt + this.s.q.seconds * 1000);
    if (this.s.duel?.phase === 'live') due.push(this.s.duel.endsAt);
    const cd = C.nextDue(this.s.contest, Date.now());
    if (cd != null) due.push(cd);
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

  /** Host contest controls (B5). Returns an error sentence, or nothing on success. */
  async hostContest(m) {
    const s = this.s;
    const db = this.env?.DB;
    if (m.t === 'contest_setup') {
      if (s.contest) return 'A contest is already set up. Close it first.';
      const asked = [...new Set((Array.isArray(m.problems) ? m.problems : []).map(String))].slice(0, C.MAX_PROBLEMS);
      if (!asked.length || !db) return `Pick ${C.MIN_PROBLEMS} to ${C.MAX_PROBLEMS} problems.`;
      // Only live problems from the bank; titles come from there, not from the message.
      const rows = (await db.prepare(`SELECT slug, title FROM problems WHERE status = 'live' AND slug IN (${asked.map(() => '?').join(',')})`).bind(...asked).all()).results;
      const title = Object.fromEntries(rows.map((r) => [r.slug, r.title]));
      const r = C.newContest({ problems: asked.filter((x) => x in title).map((slug) => ({ slug, title: title[slug] })), minutes: m.minutes, freeze: m.freeze, penalty: m.penalty });
      if (r.error) return r.error;
      s.contest = r.contest;
      return null;
    }
    const c = s.contest;
    if (!c) return 'Set up a contest first.';
    if (m.t === 'contest_teams') {
      const mode = m.mode === 'mixed' ? 'mixed' : 'random';
      const ids = this.present();
      // Level for mixed teams is lifetime points (the same number the standings use); a member with none counts as 0.
      const levels = {};
      if (mode === 'mixed' && db && ids.length) {
        try {
          const rows = (
            await db
              .prepare(
                `SELECT u.id, COALESCE(SUM(p.delta), 0) AS pts FROM users u LEFT JOIN point_events p ON p.student_id = u.student_id
                 WHERE u.id IN (${ids.map(() => '?').join(',')}) GROUP BY u.id`
              )
              .bind(...ids.map(Number))
              .all()
          ).results;
          for (const r of rows) levels[String(r.id)] = r.pts;
        } catch (err) {
          console.error('contest levels failed', err?.message ?? err);
        }
      }
      return C.setTeams(c, C.dealTeams(ids, { mode, levels })).error ?? null;
    }
    if (m.t === 'contest_move') {
      const uid = String(m.uid ?? '');
      if (!(uid in s.names)) return 'No such member.';
      return C.moveMember(c, uid, m.to ?? null).error ?? null;
    }
    if (m.t === 'contest_start') {
      const r = C.startContest(c, Date.now());
      if (r.error) return r.error;
      await this.schedule();
      return null;
    }
    if (m.t === 'contest_end') return C.endContest(c).error ?? null;
    if (m.t === 'contest_reveal') return C.revealNext(c).error ?? null;
    if (m.t === 'contest_close') {
      if (c.phase === 'live') return 'End the contest first.';
      s.contest = null;
      return null;
    }
    return 'Unknown contest command.';
  }

  /**
   * The contest as one screen sees it. Never code. The board is the public one
   * (frozen when it should be); a member also gets their own team's live
   * result, and the host console gets the true standings.
   */
  contestView(role, uid) {
    const c = this.s.contest;
    if (!c) return null;
    const now = Date.now();
    const pub = C.publicBoard(c, now);
    const mine = role === 'student' ? C.teamOf(c, uid) : null;
    const nm = (u) => first(this.s.names[u]);
    const cell = (x) => ({ ok: x.ok, wrong: x.wrong, ms: x.ms });
    const row = (r) => ({ id: r.id, name: r.name, place: r.place, solved: r.solved, penalty: r.penalty, cells: r.cells.map(cell), you: mine?.id === r.id });
    const live = c.phase === 'setup' ? [] : C.rank(C.scoreRows(c));
    const open = c.phase !== 'setup';
    const out = {
      phase: c.phase,
      problems: role === 'host' || open ? c.problems : [],
      minutes: c.minutes,
      freeze: c.freeze,
      penalty: c.penalty,
      startedAt: c.startedAt,
      endsAt: c.endsAt,
      freezeAt: C.freezeAt(c),
      frozen: pub.frozen,
      final: pub.final,
      board: pub.rows.map(row),
    };
    if (role === 'host') {
      const placed = new Set(c.teams.flatMap((t) => t.members));
      const here = this.present();
      return {
        ...out,
        teams: c.teams.map((t) => ({ id: t.id, name: t.name, members: t.members.map((u) => ({ uid: u, name: this.s.names[u] ?? 'Student' })) })),
        unassigned: here.filter((u) => !placed.has(u)).map((u) => ({ uid: u, name: this.s.names[u] ?? 'Student' })),
        live: live.map(row), // the true standings, for the console only: the projector never draws this
        revealed: c.revealed.length,
        nextReveal: C.nextReveal(c),
      };
    }
    return {
      ...out,
      team: mine && {
        id: mine.id,
        name: mine.name,
        mates: mine.members.filter((u) => u !== uid).map(nm),
        row: open ? row(live.find((r) => r.id === mine.id)) : null,
      },
    };
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

  /** The current lab block, seen by role. The host's view is counts only: it goes on the projector. */
  labView(role, uid) {
    const s = this.s;
    const block = S.currentBlock(s.session);
    if (block?.type !== 'lab') return null;
    const lab = s.labs[block.id] ?? S.freshLab();
    const cps = labCheckpoints(block);
    const tiers = block.lab.tiers.map((t, i) => ({ name: t.name, source: t.source, checkpoints: cps[i].length }));
    if (role === 'host') return { pairs: block.lab.pairs, tiers, counts: S.labCounts(lab, block.lab.tiers, cps) };
    const tier = lab.picks[uid] ?? null;
    const group = s.pairs?.find((g) => g.includes(uid));
    return {
      pairs: block.lab.pairs,
      tiers,
      tier,
      checkpoints: tier == null ? [] : cps[tier],
      passed: tier == null ? [] : (lab.passed[uid] ?? []).filter((k) => k.startsWith(`${tier}:`)).map((k) => k.slice(k.indexOf(':') + 1)),
      seat: group ? group.indexOf(uid) : 0,
    };
  }

  view(role, uid) {
    const s = this.s;
    const live = this.ctx.getWebSockets().map((w) => w.deserializeAttachment()).filter((a) => a?.role === 'student');
    const connected = new Set(live.map((a) => a.uid));
    const q = s.q;
    const host = role === 'host';
    const name = (u) => s.names[u] ?? 'Student';

    const counts = q ? q.options.map((_, i) => Object.values(s.answers).filter((a) => a.choice === i).length) : [];
    const pulse = Object.fromEntries(PULSE.map((p) => [p, Object.values(s.pulse).filter((v) => v === p).length]));
    const board = Object.entries(s.scores)
      .map(([id, v]) => ({ name: v.name, pts: v.pts, you: id === uid }))
      .sort((a, b) => b.pts - a.pts)
      .slice(0, 10);
    const openHelp = s.help.filter((h) => h.status === 'open');
    const showAnswer = host || q?.revealed;
    const sess = s.session ?? S.newSession();

    return {
      t: 'state',
      role,
      ended: s.ended,
      here: connected.size,
      answered: Object.keys(s.answers).length,
      pulse,
      board,
      stage: s.stage ?? [],
      // Block notes are officer prep: only host sockets (console and projector) get them.
      session: { kind: sess.kind, template: sess.template, blocks: host ? sess.blocks : studentBlocks(sess.blocks), cur: sess.cur, startedAt: sess.startedAt, endsAt: sess.endsAt },
      // B4: what counts so far. The host sees how many have one; a student sees their own.
      exits: host ? Object.keys(s.exits).length : undefined,
      // V3-A: everyone who checked in and connected, for the end-room warning.
      joined: host ? Object.keys(s.names).length : undefined,
      exit: host ? undefined : (s.exits[uid] ?? null),
      // B7: the projector shows the length only; names are for the officer console and members who can help.
      helpOpen: openHelp.length,
      help: host
        ? openHelp.map((h) => ({ id: h.id, topic: h.topic, name: name(h.uid), helpers: h.helpers.map(name) }))
        : openHelp.map((h) => ({
            id: h.id,
            topic: h.topic,
            name: first(name(h.uid)),
            mine: h.uid === uid,
            offered: h.helpers.includes(uid),
            ...(h.uid === uid && { helpers: h.helpers.map((u) => ({ uid: u, name: name(u) })) }),
          })),
      helped: host ? s.help.filter((h) => h.status === 'solved' && h.helper).length : undefined,
      // B8: questions are anonymous everywhere.
      speaker: {
        takeaways: s.speaker.takeaways,
        qs: S.sqOrder(s.speaker.qs).map((x) => ({ id: x.id, text: x.text, votes: x.votes.length, answered: x.answered, mine: x.uid === uid, voted: x.votes.includes(uid) })),
      },
      // B6
      show: {
        picked: s.show.picked,
        items: s.show.items.map((x) => ({ id: x.id, name: name(x.uid), kind: x.kind, url: x.url, line: x.line, result: x.result, kudos: x.kudos.length, mine: x.uid === uid, gave: x.kudos.includes(uid) })),
      },
      earned: host ? undefined : this.earned(uid),
      lab: this.labView(role, uid),
      duel: duelView(s.duel, { role, uid, names: s.names, present: [...connected] }),
      contest: this.contestView(role, uid),
      pairs: host ? s.pairs?.map((g) => g.map(name)) : s.pairs?.find((g) => g.includes(uid))?.filter((u) => u !== uid).map(name),
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
        counts: host || !q.open ? counts : null,
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
