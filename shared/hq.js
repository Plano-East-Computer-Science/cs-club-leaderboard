/**
 * Officer HQ (Wave 5): pure rules shared by the worker, the HQ screens and the
 * tests. Where old officer links land, whether the next meeting is ready, the
 * drifting-member invite and the dates on "Due this week".
 */

/* ------------------------------ old addresses ------------------------------ */

/**
 * Every screen id the old console used (`/officer?s=<id>`) and where it lives
 * in HQ now. Review queues land on the Inbox filtered to their kind; member
 * fix-ups (points, merge, records, signed lines) are actions in the member
 * drawer, so they land on Members.
 */
export const OLD_SCREENS = {
  rooms: '/hq/meetings',
  planner: '/hq/meetings',
  points: '/hq/members',
  claims: '/hq/inbox?kind=claims',
  editorials: '/hq/inbox?kind=editorials',
  reports: '/hq/inbox?kind=reports',
  links: '/hq/inbox?kind=links',
  queue: '/hq/inbox?kind=opportunities',
  merge: '/hq/members',
  members: '/hq/members',
  team: '/hq/settings/officers',
  badges: '/hq/season/badges',
  records: '/hq/members',
  signoffs: '/hq/members',
  squads: '/hq/season/squads',
  raffle: '/hq/season/raffle',
  analytics: '/hq/season/stats',
  handoff: '/hq/season/handoff',
  alumni: '/hq/season/alumni',
  problems: '/hq/library/problems',
  sets: '/hq/library/packs',
  daily: '/hq/library/daily',
  board: '/hq/library/board',
  puzzles: '/hq/library/puzzles',
  competitions: '/hq/season/competitions',
  prep: '/hq/season/prep',
  ctf: '/hq/library/ctf',
  data: '/hq/library/data',
  quant: '/hq/library/quant',
  cycles: '/hq/season/cycles',
  research: '/hq/library/research',
  opportunities: '/hq/library/opportunities',
  curriculum: '/hq/library/curriculum',
  announce: '/hq/announce',
  email: '/hq/announce',
  ideas: '/hq/meetings/ideas',
  gateway: '/hq/settings/gateway',
  reader: '/hq/settings/reader',
  officers: '/hq/settings/officers',
  text: '/hq/settings/text',
  backup: '/hq/settings/backup',
};

// Links from before the console had screens: ?tab=<group>.
const OLD_TABS = { meeting: 'rooms', review: 'claims', members: 'members', content: 'problems', club: 'announce' };

/** `/officer?s=claims` -> `/hq/inbox?kind=claims`. `search` is location.search; anything unknown lands on Home. */
export function oldOfficerTarget(search = '') {
  const q = new URLSearchParams(search);
  const id = q.get('s') || OLD_TABS[q.get('tab')];
  return (id && Object.hasOwn(OLD_SCREENS, id) && OLD_SCREENS[id]) || '/hq';
}

/* ------------------------------ inbox kinds ------------------------------ */

/** The Inbox's kinds, in the order the filter shows them. */
export const INBOX_KINDS = ['claims', 'editorials', 'ctf', 'links', 'reports', 'opportunities', 'alumni'];

/* -------------------------------- readiness -------------------------------- */

const sum = (blocks) => blocks.reduce((n, b) => n + (Number(b.minutes) || 0), 0);
const named = (b) => `"${b.title || b.type}"`;

/**
 * The checklist on Home's next-meeting card. `plan` is a planner row
 * ({ blocks, roomCode, minutes? }), `packs` the number of live duel packs.
 * Payload fields follow v2-spec section 5: a duel block's pack is
 * `duel.set`, a speaker block's name `speaker.name` (Wave 6 stores them).
 * Returns [{ id, ok, label, hint? }]; checks that do not apply are left out.
 */
export function readiness(plan, { packs = 0 } = {}) {
  const blocks = Array.isArray(plan?.blocks) ? plan.blocks : [];
  const total = sum(blocks);
  // Templates come in 60 and 120 minute versions; a plan without a stored length is read from its blocks.
  const length = Number(plan?.minutes) || (total > 90 ? 120 : 60);
  const out = [
    {
      id: 'length',
      ok: total <= length && total >= length - 10,
      label: `Blocks fill ${total} of ${length} min`,
      ...(total > length ? { hint: `${total - length} min over. Trim a block.` } : total < length - 10 ? { hint: `${length - total} min free. Add a block or lengthen one.` } : {}),
    },
  ];
  const duels = blocks.filter((b) => b.type === 'duel');
  if (duels.length) {
    const missing = duels.filter((b) => !String(b.duel?.set ?? '').trim());
    out.push({
      id: 'duel',
      ok: missing.length === 0,
      label: duels.length === 1 ? 'Duel block has a pack' : 'Every duel block has a pack',
      ...(missing.length && { hint: `Pick a pack for ${missing.map(named).join(', ')}.` }),
    });
  }
  const speakers = blocks.filter((b) => b.type === 'speaker');
  if (speakers.length) {
    const ok = speakers.some((b) => String(b.speaker?.name ?? '').trim());
    out.push({ id: 'speaker', ok, label: 'Speaker block has a name', ...(!ok && { hint: 'Add the speaker in the speaker block.' }) });
  }
  out.push({
    id: 'packs',
    ok: packs > 0,
    label: packs > 0 ? `${packs} duel ${packs === 1 ? 'pack' : 'packs'} in the Library` : 'A duel pack exists in the Library',
    ...(packs > 0 ? {} : { hint: 'Make one under Library, Duel packs.' }),
  });
  out.push({ id: 'room', ok: !plan?.roomCode, label: plan?.roomCode ? `Room ${plan.roomCode} already opened` : 'Room not opened yet' });
  return out;
}

/* ----------------------------------- dates ----------------------------------- */

const DAY = 86_400_000;
const at = (ymd) => Date.parse(`${ymd}T12:00:00Z`);
const ymdOf = (t) => new Date(t).toISOString().slice(0, 10);

/** Whole days from `from` to `to`, both YYYY-MM-DD. */
export const daysBetween = (from, to) => Math.round((at(to) - at(from)) / DAY);

/** The next date on or after `today` that falls on `weekday` (0 Sunday ... 6 Saturday). */
export function nextWeekday(today, weekday) {
  const t = at(today);
  return ymdOf(t + (((weekday - new Date(t).getUTCDay()) % 7) + 7) % 7 * DAY);
}

/** The weekly digest goes out Monday morning (cron "0 13 * * 1" in wrangler.toml). */
export const DIGEST_WEEKDAY = 1;

/** A backup is due when none was downloaded in this many days. */
export const BACKUP_DAYS = 30;

/* ---------------------------------- invite ---------------------------------- */

/**
 * The short, friendly text an officer copies for a member who has not been
 * seen in a while. Nothing is sent; the officer pastes it where they talk.
 * `next` is { date: 'YYYY-MM-DD', title } or null; `meeting` { day, time, place }.
 */
export function driftInvite(name, { next = null, meeting = {} } = {}) {
  const first = String(name ?? '').trim().split(/\s+/)[0] || 'there';
  const when = next
    ? new Date(`${next.date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })
    : meeting.day || 'Wednesday';
  const time = meeting.time ? ` at ${meeting.time}` : '';
  const place = meeting.place ? ` in ${meeting.place}` : '';
  const what = next?.title ? ` We are doing ${next.title}.` : '';
  return `Hi ${first}, we have missed you at CS Club. Our next meeting is ${when}${time}${place}.${what} Come by, no prep needed.`;
}
