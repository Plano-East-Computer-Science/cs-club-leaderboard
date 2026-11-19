/**
 * Meeting run-of-show (B1): block types, the templates an officer picks from
 * when opening a room, and the one validator every edit goes through.
 *
 * Shared by the officer screens (template picker, block editor) and the
 * room's Durable Object, so it must not import course content: courses carry
 * solutions, and this file is bundled into the browser.
 *
 * A block is { id, type, title, minutes, notes, screen, lab? }.
 *   minutes 0 means no timer. The host advances; the timer never does.
 *   notes:  officer prep ("ask Sam to go first", answers). Officers only: the
 *           room strips it from every member socket (studentBlocks below).
 *           Blocks saved before `screen` existed keep their text here, so old
 *           text stays private rather than suddenly showing on laptops.
 *   screen: the line shown on the projector and on member laptops.
 *   lab: { pairs, tiers: [{ name, source }] } where source is
 *        "course:<slug>" or "problems:<slug>,<slug>".
 *   contest (B5): { freeze, penalty } defaults for the setup form: minutes the
 *        board is frozen at the end, minutes of penalty per wrong attempt.
 *        The problem set and teams are chosen live, in the room.
 */

export const BLOCK_TYPES = ['poll', 'hook', 'lab', 'duel', 'contest', 'show', 'speaker', 'break', 'close'];

export const BLOCK_LABEL = {
  poll: 'Poll',
  hook: 'Hook',
  lab: 'Lab',
  duel: 'Duel',
  contest: 'Contest',
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

// screen is what the room sees; officer-only notes go in extra.notes.
const b = (type, title, minutes, screen = '', extra = {}) => ({ type, title, minutes, screen, ...extra });

/** V3-A: meetings run an hour or two. The room-open screen offers both; 120 is the default. */
export const LENGTHS = [60, 120];
export const DEFAULT_LENGTH = 120;

const LAB = { lab: { pairs: true, tiers: DEFAULT_TIERS } };
const PAIRS = 'Pick a tier. Driver types, navigator reads. Swap when the timer says.';
const BREAK = b('break', 'Break', 10, 'Stretch, get water, back in ten.');

/**
 * Each template comes in both lengths. Every 120-minute version has a break,
 * and every version ends with a close (that is where the exit line opens).
 */
export const TEMPLATES = {
  build: {
    name: 'Build night',
    blurb: 'Warm-up poll, a demo, a tiered lab in pairs, show, close.',
    lengths: {
      60: [
        b('poll', 'Warm-up poll', 5, 'Join, find your partner, answer the poll.'),
        b('hook', "Last week's best", 7, '', { notes: 'A member demos what they built. Ask them before the meeting.' }),
        b('lab', 'Build in pairs', 35, PAIRS, LAB),
        b('show', 'Show', 8, 'Two or three pairs, 60 seconds each.'),
        b('close', 'Close', 5, 'Next week: tell us what you want to build.'),
      ],
      120: [
        b('poll', 'Warm-up poll', 10, 'Join, find your partner, answer the poll.'),
        b('hook', "Last week's best", 10, '', { notes: 'A member demos what they built. Ask them before the meeting.' }),
        b('lab', 'Build in pairs', 40, PAIRS, LAB),
        BREAK,
        b('lab', 'Second round: swap roles', 30, 'Same pairs, roles swapped. Pick up a tier, or try the next one.', LAB),
        b('show', 'Show', 15, 'Four or five pairs, 60 seconds each.'),
        b('close', 'Close', 5, 'Next week: tell us what you want to build.'),
      ],
    },
  },
  duel: {
    name: 'Duel night',
    blurb: 'Matched races by division, with a spotlight after each round.',
    lengths: {
      60: [
        b('hook', 'Join and practice', 5, 'Check in, then try the practice problem.'),
        b('hook', 'Tonight: duels', 5, 'Pick your division honestly. It is more fun close.'),
        b('duel', 'Three rounds', 39, 'Rounds of 10 minutes, a 3-minute spotlight after each.', { notes: 'Set 10-minute rounds. Spotlight one solver after each round.' }),
        b('show', 'Upsolve', 8, 'How the winners solved it. Then finish the ones you missed.'),
        b('close', 'Close', 3),
      ],
      120: [
        b('hook', 'Join and practice', 10, 'Check in, then try the practice problem.'),
        b('hook', 'Tonight: duels', 10, 'Pick your division honestly. It is more fun close.'),
        b('duel', 'Three rounds', 45, 'Rounds of 12 minutes, a 3-minute spotlight after each.', { notes: 'Set 12-minute rounds. Spotlight one solver after each round.' }),
        BREAK,
        b('duel', '2v2 final', 20, 'Pairs race one last problem together.', { notes: 'Pair the room first, then start one round on the final problem.' }),
        b('show', 'Upsolve', 15, "Walk through tonight's problems, then finish the ones you missed."),
        b('close', 'Close', 10),
      ],
    },
  },
  mock: {
    name: 'Mock contest',
    blurb: 'Teams of three, a problem set, a scoreboard that freezes for the last ten minutes, then the reveal.',
    lengths: {
      60: [
        b('hook', 'Rules and teams', 5, 'Contest format. No outside help.'),
        b('contest', 'Mock contest', 45, 'Teams of three. Any teammate can submit. The board freezes for the last ten minutes.', { contest: { freeze: 10, penalty: 20 } }),
        b('close', 'Reveal and close', 10),
      ],
      120: [
        b('hook', 'Rules and teams', 10, 'Contest format. No outside help.'),
        b('contest', 'Mock contest', 70, 'Teams of three. Any teammate can submit. The board freezes for the last ten minutes.', { contest: { freeze: 10, penalty: 20 } }),
        BREAK,
        b('show', 'Upsolve', 20, 'One solution per problem, explained by the team that got it.'),
        b('close', 'Close', 10),
      ],
    },
  },
  speaker: {
    name: 'Speaker night',
    blurb: 'A guest talk with upvoted questions and a takeaways pad.',
    lengths: {
      60: [
        b('hook', 'Welcome', 5, '', { notes: 'Introduce the speaker.' }),
        b('speaker', 'Talk and questions', 45, 'Send questions any time. Upvote the ones you want answered.'),
        b('close', 'Close', 10),
      ],
      120: [
        b('poll', 'Warm-up poll', 10, 'Check in and answer the poll.'),
        b('hook', 'Welcome', 5, '', { notes: 'Introduce the speaker.' }),
        b('speaker', 'Talk', 45, 'Send questions any time. Upvote the ones you want answered.'),
        BREAK,
        b('speaker', 'Questions', 35, 'Most votes first. Keep sending them.'),
        b('close', 'Close', 15),
      ],
    },
  },
  demo: {
    name: 'Demo day',
    blurb: 'End of a ship cycle: everyone shows what they built.',
    lengths: {
      60: [
        b('hook', 'Demo day', 5, 'Order of demos on the board.'),
        b('show', 'Demos', 45, 'Submit your link. Kudos the ones you liked.'),
        b('close', 'Close', 10),
      ],
      120: [
        b('hook', 'Demo day', 5, 'Order of demos on the board.'),
        b('show', 'Demos, first half', 50, 'Submit your link. Kudos the ones you liked.'),
        BREAK,
        b('show', 'Demos, second half', 45, 'Submit your link. Kudos the ones you liked.'),
        b('close', 'Close', 10),
      ],
    },
  },
};

/** 60 or 120 from anything; everything else is the default. */
export const lengthOf = (v) => (LENGTHS.includes(Number(v)) ? Number(v) : DEFAULT_LENGTH);

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

function cleanContest(c) {
  const n = (v, d, max) => (Number.isFinite(Math.round(Number(v))) && Number(v) >= 0 && Number(v) <= max ? Math.round(Number(v)) : d);
  return { freeze: n(c?.freeze, 10, 60), penalty: n(c?.penalty, 20, 120) };
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
      screen: String(x.screen ?? '').trim().slice(0, 500),
    };
    if (x.type === 'lab') out.lab = cleanLab(x.lab);
    if (x.type === 'contest') out.contest = cleanContest(x.contest);
    return out;
  });
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * V3-A: what ending a room will do, for the in-page confirm on the host
 * console. `joined` is everyone who checked in and connected, `exits` those
 * who did something that earns the bonus. Returns sentences, plainest first.
 */
export function endWarning({ joined = 0, exits = 0, dropin = false, duelLive = false, contestLive = false, helpOpen = 0 }) {
  const out = [];
  if (!joined) out.push('Nobody has checked in, so nobody is paid.');
  else {
    out.push(`${joined} checked in will be paid ${dropin ? 'the drop-in amount' : 'attendance'}.`);
    const quiet = Math.max(0, joined - exits);
    if (quiet) out.push(`${plural(quiet, 'has', 'have')} not done anything else yet, so no bonus.`);
  }
  if (duelLive) out.push('A duel round is still running. Ending scores it as it stands.');
  if (contestLive) out.push('The contest is still running. Ending closes submissions now.');
  if (helpOpen) out.push(`${plural(helpOpen, 'help request is', 'help requests are')} still open.`);
  return out;
}

/** Blocks as a member's laptop may see them: officer notes removed. */
export const studentBlocks = (blocks) => (blocks ?? []).map(({ notes, ...rest }) => rest);

/** A fresh copy of a template's blocks at 60 or 120 minutes, with ids, or [] for a drop-in / unknown id. */
export function templateBlocks(id, minutes = DEFAULT_LENGTH) {
  return TEMPLATES[id] ? cleanBlocks(TEMPLATES[id].lengths[lengthOf(minutes)]) : [];
}
