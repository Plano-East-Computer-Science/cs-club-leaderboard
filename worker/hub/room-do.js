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
const PULSE = ['fast', 'slow', 'lost', 'great'];

const fresh = () => ({
  q: null, // { id, text, options, correct, seconds, openedAt, open, revealed }
  answers: {}, // uid -> { choice, ms }
  scores: {}, // uid -> { name, pts }
  pulse: {}, // uid -> one of PULSE
  names: {}, // uid -> name (everyone who has connected)
  ended: false,
  seq: 0,
});

export class Room {
  constructor(ctx) {
    this.ctx = ctx;
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
        await this.ctx.storage.setAlarm(Date.now() + seconds * 1000);
      } else if (m.t === 'close' && s.q?.open) {
        this.closeQuestion();
      } else if (m.t === 'reveal' && s.q) {
        if (s.q.open) this.closeQuestion();
        s.q.revealed = true;
      } else if (m.t === 'clear_pulse') {
        s.pulse = {};
      } else if (m.t === 'end') {
        s.ended = true;
        s.q = s.q && { ...s.q, open: false };
      } else return;
    } else if (role === 'student') {
      if (m.t === 'answer' && s.q?.open && !(uid in s.answers)) {
        const choice = Number(m.choice);
        if (!Number.isInteger(choice) || choice < 0 || choice >= s.q.options.length) return;
        s.answers[uid] = { choice, ms: Date.now() - s.q.openedAt };
      } else if (m.t === 'pulse' && PULSE.includes(m.v)) {
        s.pulse[uid] = m.v;
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
    if (this.s.q?.open) {
      this.closeQuestion();
      await this.save();
      this.broadcast();
    }
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
