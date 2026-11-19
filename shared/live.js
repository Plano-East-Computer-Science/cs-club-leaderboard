/**
 * Wave 6, the live meeting: pure rules shared by the worker and the browser.
 *
 *   meetingStart   a planned date plus the club's meeting time ("4:30 PM") as a UTC instant
 *   earlyWindow    when the speaker question window opens (openEarlyHours before the start)
 *   champions      the duel champion per division, from a room's duel_results rows
 *   isStuck        a lab member on the same checkpoint for ten minutes or more
 *
 * No Node or Worker APIs here: this file is bundled into the browser.
 */

export const TZ = 'America/Chicago';
export const STUCK_MINUTES = 10;

/** "4:30 PM", "4 pm", "16:30" -> { h, m }. Anything unreadable is the club default, 4:30 PM. */
export function parseMeetingTime(s) {
  const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*([ap])?\.?\s*m?\.?\s*$/i.exec(String(s ?? ''));
  if (!m) return { h: 16, m: 30 };
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const ap = m[3]?.toLowerCase();
  if (ap === 'p' && h < 12) h += 12;
  if (ap === 'a' && h === 12) h = 0;
  return h < 24 && min < 60 ? { h, m: min } : { h: 16, m: 30 };
}

/** How far a zone's wall clock is ahead of UTC at one instant, in ms. */
function zoneOffset(utcMs, tz) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(utcMs)
      .map((x) => [x.type, x.value])
  );
  return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second)) - utcMs;
}

/** The instant a meeting on `date` (YYYY-MM-DD, Central) at `time` starts, in ms. */
export function meetingStart(date, time, tz = TZ) {
  const [y, mo, d] = String(date).split('-').map(Number);
  const { h, m } = parseMeetingTime(time);
  const guess = Date.UTC(y, mo - 1, d, h, m);
  return guess - zoneOffset(guess, tz);
}

/** { opensAt, startsAt, open }: questions open `hours` before the start and stay open until the room opens. */
export function earlyWindow({ date, time, hours, now = Date.now() }) {
  const startsAt = meetingStart(date, time);
  const opensAt = startsAt - Math.max(0, Number(hours) || 0) * 3_600_000;
  return { opensAt, startsAt, open: now >= opensAt };
}

/**
 * The champion of each division in one room's duels. rows are duel_results
 * ({ division, user_id, won, solved_ms }); the champion has the most wins,
 * then the most solves, then the least total solve time. A division where
 * nobody won or solved anything has no champion.
 */
export function champions(rows) {
  const by = {};
  for (const r of rows ?? []) {
    const d = (by[r.division] ??= {});
    const u = (d[r.user_id] ??= { user_id: r.user_id, name: r.name, wins: 0, solved: 0, ms: 0 });
    u.wins += r.won ? 1 : 0;
    if (r.solved_ms != null) {
      u.solved += 1;
      u.ms += Number(r.solved_ms);
    }
  }
  const out = [];
  for (const division of ['new', 'comfortable', 'contest']) {
    const best = Object.values(by[division] ?? {})
      .filter((u) => u.wins || u.solved)
      .sort((a, b) => b.wins - a.wins || b.solved - a.solved || a.ms - b.ms)[0];
    if (best) out.push({ division, ...best });
  }
  return out;
}

/** Is a lab member stuck? `since` is when they picked their tier or last passed a checkpoint. */
export const isStuck = (p, now, minutes = STUCK_MINUTES) => Boolean(p && !p.done && p.since != null && now - p.since >= minutes * 60_000);

/** "Ask at club.org/room, code ABCD": what the Zoom strip and the speaker screens say. */
export const askLine = (host, code) => `Ask at ${host}/room, code ${code}`;
