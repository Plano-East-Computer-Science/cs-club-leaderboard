/**
 * Meeting run-of-show (B1): block types, the templates an officer picks from
 * when opening a room, and the one validator every edit goes through.
 *
 * Shared by the officer screens (template picker, block editor) and the
 * room's Durable Object, so it must not import course content: courses carry
 * solutions, and this file is bundled into the browser.
 *
 * A block is { id, type, title, minutes, notes, lab? }.
 *   minutes 0 means no timer. The host advances; the timer never does.
 *   lab: { pairs, tiers: [{ name, source }] } where source is
 *        "course:<slug>" or "problems:<slug>,<slug>".
 */

export const BLOCK_TYPES = ['poll', 'hook', 'lab', 'duel', 'show', 'speaker', 'break', 'close'];

export const BLOCK_LABEL = {
  poll: 'Poll',
  hook: 'Hook',
  lab: 'Lab',
  duel: 'Duel',
  show: 'Show',
  speaker: 'Speaker',
  break: 'Break',
  close: 'Close',
};

const MAX_BLOCKS = 12;
const SOURCE = /^(course:[a-z0-9-]{1,60}|problems:[a-z0-9-]{1,80}(,[a-z0-9-]{1,80}){0,9})$/;

/** The three default lab tiers: fill in the blanks, build from a spec, a contest stretch. */
export const DEFAULT_TIERS = [
  { name: 'Guided', source: 'course:lab-madlibs' },
  { name: 'Build', source: 'course:lab-ascii-art' },
  { name: 'Stretch', source: 'course:cp-patterns' },
];

const b = (type, title, minutes, notes = '', extra = {}) => ({ type, title, minutes, notes, ...extra });

export const TEMPLATES = {
  build: {
    name: 'Build night',
    blurb: 'Warm-up poll, a demo, a tiered lab in pairs, show, close.',
    blocks: [
      b('poll', 'Warm-up poll', 5, 'Join, find your partner, answer the poll.'),
      b('hook', "Last week's best", 7, 'A member demos what they built.'),
      b('lab', 'Build in pairs', 26, 'Pick a tier. Driver types, navigator reads. Swap when the timer says.', { lab: { pairs: true, tiers: DEFAULT_TIERS } }),
      b('show', 'Show', 5, 'Two or three pairs, 60 seconds each.'),
      b('close', 'Close', 2, 'Next week: tell us what you want to build.'),
    ],
  },
  duel: {
    name: 'Duel night',
    blurb: 'Matched races by division, with a spotlight after each round.',
    blocks: [
      b('poll', 'Warm-up poll', 5),
      b('hook', 'Tonight: duels', 5, 'Pick your division honestly. It is more fun close.'),
      b('duel', 'Duel', 30),
      b('show', 'How I solved it', 3),
      b('close', 'Close', 2),
    ],
  },
  mock: {
    name: 'Mock contest',
    // B5 (team contest with a frozen board) does not exist yet: a duel block stands in.
    blurb: 'Contest practice. Runs as a duel until the team contest block exists.',
    blocks: [
      b('hook', 'Rules and teams', 5, 'Contest format. No outside help.'),
      b('duel', 'Mock contest', 35, 'Duel format until the team contest block is built.'),
      b('close', 'Close', 5),
    ],
  },
  speaker: {
    name: 'Speaker night',
    blurb: 'A guest talk with upvoted questions and a takeaways pad.',
    blocks: [
      b('hook', 'Welcome', 3, 'Introduce the speaker.'),
      b('speaker', 'Talk and questions', 35, 'Send questions any time. Upvote the ones you want answered.'),
      b('close', 'Close', 7),
    ],
  },
  demo: {
    name: 'Demo day',
    blurb: 'End of a ship cycle: everyone shows what they built.',
    blocks: [
      b('hook', 'Demo day', 3, 'Order of demos on the board.'),
      b('show', 'Demos', 35, 'Submit your link. Kudos the ones you liked.'),
      b('close', 'Close', 7),
    ],
  },
};

/** Room kinds: a normal meeting, or a Panther Pause drop-in (B10) with no agenda. */
export const ROOM_KINDS = ['meeting', 'dropin'];

const str = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

function cleanLab(lab) {
  const tiers = (Array.isArray(lab?.tiers) ? lab.tiers : [])
    .map((t) => ({ name: str(t?.name, 24), source: String(t?.source ?? '').trim().toLowerCase() }))
    .filter((t) => t.name && SOURCE.test(t.source))
    .slice(0, 3);
  return { pairs: lab?.pairs === true, tiers: tiers.length ? tiers : DEFAULT_TIERS.map((t) => ({ ...t })) };
}

/**
 * Validates a block list from an officer. Unknown types are dropped, text is
 * trimmed, minutes are 0-90, ids are kept when well-formed (so the current
 * block survives an edit) and made up otherwise.
 */
export function cleanBlocks(blocks) {
  const list = (Array.isArray(blocks) ? blocks : []).filter((x) => BLOCK_TYPES.includes(x?.type)).slice(0, MAX_BLOCKS);
  const used = new Set();
  let next = 1 + Math.max(0, ...list.map((x) => (/^b(\d{1,4})$/.test(x.id) ? Number(x.id.slice(1)) : 0)));
  return list.map((x) => {
    let id = /^b\d{1,4}$/.test(x.id) && !used.has(x.id) ? x.id : `b${next++}`;
    used.add(id);
    const m = Math.round(Number(x.minutes));
    const out = {
      id,
      type: x.type,
      title: str(x.title, 60) || BLOCK_LABEL[x.type],
      minutes: m >= 0 && m <= 90 ? m : 0,
      notes: String(x.notes ?? '').trim().slice(0, 500),
    };
    if (x.type === 'lab') out.lab = cleanLab(x.lab);
    return out;
  });
}

/** A fresh copy of a template's blocks with ids, or [] for a drop-in / unknown id. */
export function templateBlocks(id) {
  return TEMPLATES[id] ? cleanBlocks(TEMPLATES[id].blocks) : [];
}
