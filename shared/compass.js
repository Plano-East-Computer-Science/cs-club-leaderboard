/**
 * The onboarding compass (E1). Six questions, the path they lead to, and what
 * each path tells a member to do first. Pure data and functions, shared by the
 * worker (stores the path, picks the next action) and the page that asks.
 */

export const QUESTIONS = [
  {
    id: 'coded',
    q: 'Have you coded before?',
    options: [
      ['never', 'Not yet'],
      ['little', 'A little, in class or tutorials'],
      ['builds', 'Yes, I make my own things'],
      ['contests', 'Yes, I do contests'],
    ],
  },
  {
    id: 'fun',
    q: 'Which of these sounds fun?',
    hint: 'Pick as many as you like.',
    multi: true,
    options: [
      ['contests', 'Solving contest problems'],
      ['apps', 'Building apps and websites'],
      ['ai', 'AI and language models'],
      ['data', 'Digging into data'],
      ['security', 'Security and hacking challenges'],
      ['unsure', 'Not sure yet'],
    ],
  },
  {
    id: 'goal',
    q: 'What are you aiming at?',
    options: [
      ['fun', 'Having fun with friends'],
      ['competitions', 'Winning competitions'],
      ['college', 'Something for college applications'],
      ['internship', 'An internship or a job'],
      ['figure', 'Figuring that out'],
    ],
  },
  { id: 'grade', q: 'What grade are you in?', options: [['9', '9th'], ['10', '10th'], ['11', '11th'], ['12', '12th']] },
  {
    id: 'time',
    q: 'How much time do you have outside meetings?',
    options: [
      ['low', 'Under an hour a week'],
      ['mid', 'One to three hours'],
      ['high', 'More than three hours'],
    ],
  },
  {
    id: 'teammate',
    q: 'Do you want a teammate?',
    options: [
      ['yes', 'Yes, pair me up'],
      ['maybe', 'Sometimes'],
      ['no', 'I prefer to work alone'],
    ],
  },
];

export const PATH_IDS = ['contest', 'builder', 'ai', 'data', 'cyber', 'explorer'];

/**
 * What each path is and the first three things to do. `course` items are
 * ticked off from lesson progress; `check` items from counts on the account;
 * plain links are shown on the result screen but never picked as the next
 * action, because the app cannot tell when they are done.
 */
export const PATHS = {
  contest: {
    name: 'Contest',
    about: 'You like problems with a right answer and a clock. The club enters USACO, UIL and CodeWars as teams, and you train for them here.',
    first: [
      { title: 'Python for contests', to: '/learn/python-contests', course: 'python-contests' },
      { title: 'Five patterns that win Bronze', to: '/learn/cp-patterns', course: 'cp-patterns' },
      { title: 'Pick a contest to enter', to: '/competitions' },
    ],
  },
  builder: {
    name: 'Builder',
    about: 'You want to make things people can use. Ship small projects, put them on your portfolio, and find a teammate at build night.',
    first: [
      { title: 'Git, GitHub and the club gateway', to: '/learn/git-and-the-gateway', course: 'git-and-the-gateway' },
      { title: 'Post your first project', to: '/projects', check: 'projects' },
      { title: 'Vote on what we build next', to: '/ideas', check: 'ideas' },
    ],
  },
  ai: {
    name: 'AI',
    about: 'You want to know how language models work and how to build with them. Start by building a tiny one yourself, then learn to prompt like an engineer.',
    first: [
      { title: 'Build a tiny language model', to: '/learn/llm-how-it-works', course: 'llm-how-it-works' },
      { title: 'Prompting like an engineer', to: '/learn/llm-prompting', course: 'llm-prompting' },
      { title: 'Post what you build', to: '/projects', check: 'projects' },
    ],
  },
  data: {
    name: 'Data',
    about: 'You like finding the story inside a pile of numbers. Load a real dataset, chart it, then look for a data competition to enter.',
    first: [
      { title: 'Your first dataset', to: '/learn/data-first-look', course: 'data-first-look' },
      { title: 'Charts in the terminal', to: '/learn/data-text-charts', course: 'data-text-charts' },
      { title: 'Find a data competition', to: '/opportunities?q=data' },
    ],
  },
  cyber: {
    name: 'Cyber',
    about: 'You like breaking things to learn how they work. Capture your first flags here, then join the cyber team for CTF season.',
    first: [
      { title: 'First flags', to: '/learn/cyber-first-flags', course: 'cyber-first-flags' },
      { title: 'Meet the cyber team', to: '/cyber' },
      { title: 'Find a CTF to enter', to: '/opportunities?q=ctf' },
    ],
  },
  explorer: {
    name: 'Explorer',
    about: 'You do not have to know yet. Try one small thing from each area, come to meetings, and the thing you keep coming back to is your answer.',
    first: [
      { title: 'Lab: Mad Libs machine', to: '/learn/lab-madlibs', course: 'lab-madlibs' },
      { title: 'Join a meeting with the room code', to: '/room', check: 'meetings' },
      { title: 'Tell us what to run next', to: '/ideas', check: 'ideas' },
    ],
  },
};

/** Secondary blocks on Today, most useful first for each path. */
export const BLOCK_ORDER = {
  contest: ['deadlines', 'quests', 'claims', 'projects'],
  builder: ['projects', 'deadlines', 'claims', 'quests'],
  ai: ['projects', 'quests', 'deadlines', 'claims'],
  data: ['projects', 'deadlines', 'quests', 'claims'],
  cyber: ['deadlines', 'quests', 'claims', 'projects'],
  explorer: ['quests', 'deadlines', 'projects', 'claims'],
};

/**
 * Validates submitted answers. Returns { answers } with only known ids and
 * options, or { error }. Every question must be answered.
 */
export function cleanAnswers(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Send your answers as an object.' };
  const out = {};
  for (const q of QUESTIONS) {
    const valid = q.options.map(([v]) => v);
    const v = input[q.id];
    if (q.multi) {
      const list = Array.isArray(v) ? [...new Set(v.map(String))] : [];
      if (!list.length || list.some((x) => !valid.includes(x))) return { error: `Pick at least one answer for "${q.q}"` };
      out[q.id] = list;
    } else {
      if (!valid.includes(String(v))) return { error: `Pick an answer for "${q.q}"` };
      out[q.id] = String(v);
    }
  }
  return { answers: out };
}

/**
 * Answers to a path. What sounds fun counts most; the goal and coding history
 * break ties. Nothing fun picked (or only "not sure") means explorer, unless
 * the goal points one way clearly.
 */
export function derivePath(a = {}) {
  const fun = (Array.isArray(a.fun) ? a.fun : []).filter((x) => x !== 'unsure');
  if (!fun.length) {
    if (a.goal === 'competitions') return 'contest';
    if (a.goal === 'internship') return 'builder';
    return 'explorer';
  }
  // A beginner who ticked nearly everything has not chosen yet.
  if (fun.length >= 4 && (a.coded === 'never' || a.coded === 'little')) return 'explorer';
  const score = { contest: 0, builder: 0, ai: 0, data: 0, cyber: 0 };
  const FUN = { contests: 'contest', apps: 'builder', ai: 'ai', data: 'data', security: 'cyber' };
  for (const f of fun) if (FUN[f]) score[FUN[f]] += 2;
  if (a.goal === 'competitions') score.contest += 1.5;
  if (a.goal === 'internship' || a.goal === 'college') score.builder += 1;
  if (a.coded === 'contests') score.contest += 1;
  if (a.coded === 'builds') score.builder += 0.5;
  // Ties go to the order of PATH_IDS: contest, builder, ai, data, cyber.
  let best = 'explorer';
  let top = 0;
  for (const p of PATH_IDS) if (score[p] > top) [best, top] = [p, score[p]];
  return best;
}
