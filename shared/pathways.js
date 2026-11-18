/**
 * Pathways (E5): goal pages with a concrete sequence of steps. Pure data and
 * functions, shared by the worker (progress, Today's next action) and the
 * pages. Content is curated, not written: every step points at something that
 * already exists (an Arena rung, an opportunity, a club competition, a ship
 * cycle, a starter, the portfolio) or a well-known free outside resource.
 *
 * Dates and rules that change each year (contest windows, exam format) are
 * never stated here; steps send the member to the source to check.
 *
 * Step kinds, and when one is done without the member ticking it:
 *   rung       { track, url }        the Arena rung is done (or its /learn course is finished)
 *   opp        { match?, type? }     saved ("I'm doing this") or competed in a matching opportunity
 *   comp       { match }             on the roster of a club competition whose name contains match ('' = any)
 *   cycle      { need }              'enter' = on a ship cycle entry, 'ship' = a cycle ship was approved
 *   project    {}                    posted a project
 *   portfolio  { need }              'public' | 'signoff' | 'record' (a live verified record code)
 *   starter    { slug }              never automatic: the member ticks it
 *   link       { url? }              never automatic: the member ticks it
 * Any step can also be ticked by hand (honour system). Ticks never earn points.
 */

export const MAX_FOLLOW = 2;

export const PATHWAYS = [
  {
    id: 'usaco-silver',
    title: 'USACO Silver by March',
    who: 'Contest',
    about:
      'For a member who can code a little and wants to reach the Silver division this season. Everyone starts in Bronze. In recent seasons the online contests ran in January and February, so the plan is to train in the fall and promote in one of those contests. Check usaco.org for this season\'s dates and rules.',
    steps: [
      { id: 'lang', kind: 'rung', track: 'contest', url: '/learn/python-contests', title: 'Python for contests', time: '2 to 3 hours', why: 'Every judged problem reads input and prints output the same way. Learn it once and stop losing points to it.' },
      { id: 'intro', kind: 'rung', track: 'contest', url: 'https://usaco.guide/general/intro-cp', title: 'What competitive programming is', time: '20 minutes', why: 'Know how divisions, contests and scoring work before you train for them.' },
      { id: 'account', kind: 'link', url: 'https://usaco.org/', title: 'Make a USACO account and note this season\'s contest dates', time: '15 minutes', why: 'The schedule changes from season to season. Put the dates in your calendar now so a contest weekend does not sneak past.' },
      { id: 'time', kind: 'rung', track: 'contest', url: 'https://usaco.guide/bronze/time-comp', title: 'Time complexity', time: '1 hour', why: 'It tells you before you write any code whether an idea is fast enough to pass.' },
      { id: 'search', kind: 'rung', track: 'contest', url: 'https://usaco.guide/bronze/intro-complete', title: 'Complete search', time: '4 to 6 hours over a week', why: 'Many Bronze problems fall to trying every option carefully. This is the core Bronze skill.' },
      { id: 'mock', kind: 'link', url: 'https://usaco.org/index.php?page=contests', title: 'Do a past Bronze contest under time', time: 'One afternoon', why: 'Past contests come with solutions. Doing one on a clock shows you what a real contest feels like before it counts.' },
      { id: 'enter', kind: 'opp', match: 'USACO', title: 'Enter a USACO contest', time: 'One contest weekend', why: 'Mark USACO as "I\'m doing this" on the opportunity board, then take the contest. A perfect score promotes you during the contest; otherwise the promotion cutoff comes out with the results.' },
      { id: 'prefix', kind: 'rung', track: 'contest', url: 'https://usaco.guide/silver/prefix-sums', title: 'Prefix sums', time: '3 to 4 hours', why: 'The first Silver topic, and it turns slow range questions into one subtraction.' },
      { id: 'bsearch', kind: 'rung', track: 'contest', url: 'https://usaco.guide/silver/binary-search', title: 'Binary search', time: '4 to 6 hours', why: 'Searching on the answer is a Silver favourite. With prefix sums it covers a lot of the division.' },
    ],
  },
  {
    id: 'first-internship',
    title: 'First internship',
    who: 'Resume',
    about:
      'For a member who wants real work experience in tech before graduating. Internships for high school students exist but there are not many, so the plan is to have something finished to show, then apply to several. Many summer programs take applications in the winter and early spring, so start in the fall.',
    steps: [
      { id: 'git', kind: 'rung', track: 'build', url: '/learn/git-and-the-gateway', title: 'Git, GitHub and the club gateway', time: '2 hours', why: 'A reviewer will look for your GitHub profile. Learn to commit and push first.' },
      { id: 'site', kind: 'starter', slug: 'personal-site', title: 'Make a personal site', time: 'About 1 hour', why: 'A one-page site about you is the link you put on every application.' },
      { id: 'project', kind: 'project', title: 'Post a project', time: '15 minutes', why: 'Something finished, with a repository and a short description, is what you talk about in an interview.' },
      { id: 'cycle', kind: 'cycle', need: 'enter', title: 'Enter a ship cycle', time: 'Three weeks', why: 'A deadline and a demo day get a project finished. Unfinished projects are hard to show.' },
      { id: 'portfolio', kind: 'portfolio', need: 'public', title: 'Turn on your public portfolio', time: '5 minutes', why: 'One link that shows verified attendance, projects and results, checked by officers.' },
      { id: 'resume', kind: 'link', title: 'Write a one-page resume', time: '2 hours', why: 'Use your portfolio as the list of what to include. One page, newest first, with links.' },
      { id: 'find', kind: 'opp', type: 'internship', title: 'Save internships you qualify for', time: '1 hour', why: 'Mark them "I\'m doing this" so the deadlines reach your Today page and digest. Check the age and grade rules before you write anything.' },
      { id: 'read', kind: 'link', title: 'Ask an officer or teacher to read one application', time: 'A week, ask early', why: 'A second reader catches what you cannot see. Give them time before the deadline.' },
      { id: 'apply', kind: 'link', title: 'Apply to at least three', time: 'A few evenings', why: 'Applying to several is normal. One no tells you very little, so do not stop at the first.' },
    ],
  },
  {
    id: 'science-fair',
    title: 'Science fair project',
    who: 'Quiet',
    about:
      'For a member who wants to enter a computing or data project in the science fair. Your school and regional fair set the deadlines, and many regional fairs follow the rules of Regeneron ISEF. Some projects need forms approved before you collect any data, so the rules come first.',
    steps: [
      { id: 'rules-local', kind: 'link', title: 'Get this year\'s forms and deadlines from your science teacher', time: '30 minutes', why: 'Deadlines are set by your school and region. Some forms are due before you start.' },
      { id: 'rules-isef', kind: 'link', url: 'https://www.societyforscience.org/isef/international-rules/', title: 'Read the ISEF rules that apply to you', time: '1 hour', why: 'If your project involves people, such as a survey or testing an app on classmates, it needs review and approval before you collect any data.' },
      { id: 'question', kind: 'link', title: 'Write one testable question', time: 'A week of thinking', why: 'A good question names what you will change and what you will measure. Run it past a teacher.' },
      { id: 'data', kind: 'rung', track: 'data', url: '/learn/data-first-look', title: 'Your first dataset', time: '2 hours', why: 'Most computing projects end up as data projects. Learn to load, total and filter a table.' },
      { id: 'pandas', kind: 'rung', track: 'data', url: 'https://www.kaggle.com/learn/pandas', title: 'Kaggle: Pandas', time: '4 hours', why: 'The tool you will use to clean your data and make the tables for your board.' },
      { id: 'ml', kind: 'rung', track: 'data', url: 'https://www.kaggle.com/learn/intro-to-machine-learning', title: 'Kaggle: Intro to Machine Learning', time: '3 hours', why: 'Only if your question needs a model. It shows how to test a model on data it has not seen, which judges will ask about.' },
      { id: 'arena', kind: 'link', url: '/arena/data', title: 'Practise on a club dataset', time: '1 to 2 hours', why: 'The data arena scores predictions against hidden answers, the same way you should judge your own results.' },
      { id: 'log', kind: 'link', title: 'Keep a dated project notebook', time: 'Ten minutes a session', why: 'Write down what you tried and what happened, each time. It is how you answer "how did you get this result?"' },
      { id: 'talk', kind: 'link', title: 'Make the board and practise the talk on a clubmate', time: 'Two weeks before the fair', why: 'You will explain the project out loud. Practise on someone who has not seen it.' },
    ],
  },
  {
    id: 'ap-csa',
    title: 'AP CSA 5',
    who: 'Undecided',
    about:
      'For a member taking AP Computer Science A or studying for it alone. The course and exam use a subset of Java, and the exam is in May. Check AP Central for this year\'s exam date and format so your practice matches the real thing.',
    steps: [
      { id: 'ced', kind: 'link', url: 'https://apcentral.collegeboard.org/courses/ap-computer-science-a', title: 'Read the course and exam description', time: '1 hour', why: 'It lists every unit and how much each counts. In the current version, data collections carries the most weight in multiple choice.' },
      { id: 'codingbat', kind: 'link', url: 'https://codingbat.com/java', title: 'Java warm-ups on CodingBat', time: '6 to 8 hours over a month', why: 'Short Java problems with instant checks on strings, loops and arrays, the basics every unit builds on.' },
      { id: 'judge', kind: 'rung', track: 'contest', url: 'https://cses.fi/problemset/task/1068', title: 'Solve Weird Algorithm in Java', time: '1 hour', why: 'A real judge tells you if your Java is right. Good practice with Scanner and long numbers.' },
      { id: 'checks', kind: 'link', title: 'Do the progress checks in AP Classroom', time: 'About an hour per unit', why: 'Your teacher can assign them. They match the exam\'s style and show you which unit to review.' },
      { id: 'uil', kind: 'comp', match: 'UIL', title: 'Sign up for UIL Computer Science', time: 'A season of practice', why: 'UIL uses Java too, so contest practice doubles as AP practice, and it counts for the club.' },
      { id: 'frq', kind: 'link', url: 'https://apcentral.collegeboard.org/courses/ap-computer-science-a/exam/past-exam-questions', title: 'Past free-response questions', time: '4 to 6 hours', why: 'Real questions from past exams, with scoring guidelines. Grade your own answers with the guidelines, not by feel.' },
      { id: 'mock', kind: 'link', title: 'Take one full practice exam on a clock', time: 'One afternoon in April', why: 'Timing is a skill. Ask your teacher for a full practice exam and take it in one sitting.' },
    ],
  },
  {
    id: 'college-portfolio',
    title: 'Build a portfolio for college',
    who: 'Resume',
    about:
      'For a member who wants a record of real work by application season. Colleges only see what you show them. This pathway fills your portfolio page with things officers have checked: shipped projects, competitions and a signed note.',
    steps: [
      { id: 'git', kind: 'rung', track: 'build', url: '/learn/git-and-the-gateway', title: 'Git, GitHub and the club gateway', time: '2 hours', why: 'Your projects need to live somewhere a reader can open them.' },
      { id: 'site', kind: 'starter', slug: 'personal-site', title: 'Make a personal site', time: 'About 1 hour', why: 'A home for everything else on this list, at an address you control.' },
      { id: 'project', kind: 'project', title: 'Post a project', time: '15 minutes', why: 'Projects you post show on your portfolio with their repository data.' },
      { id: 'cycle', kind: 'cycle', need: 'enter', title: 'Enter a ship cycle', time: 'Three weeks', why: 'A theme, a deadline and teammates. It is the easiest way to finish something.' },
      { id: 'ship', kind: 'cycle', need: 'ship', title: 'Demo it and ship', time: 'Demo day', why: 'A project demoed at a meeting is verified by an officer, which counts for more than a link alone.' },
      { id: 'compete', kind: 'comp', match: '', title: 'Sign up for a club competition', time: 'One event', why: 'Results go on your portfolio whether you place or not. Entering is what counts.' },
      { id: 'public', kind: 'portfolio', need: 'public', title: 'Turn on your public portfolio', time: '5 minutes', why: 'It is private until you turn it on. Then it is one link for applications.' },
      { id: 'signoff', kind: 'portfolio', need: 'signoff', title: 'Ask an officer for a sign-off line', time: 'Ask at a meeting', why: 'One sentence from an officer, with their name and the date, says more than a list of activities.' },
      { id: 'record', kind: 'portfolio', need: 'record', title: 'Get a verified record code', time: 'Ask at a meeting', why: 'A counselor or college can check your record themselves with the code.' },
    ],
  },
];

export const pathwayOf = (id) => PATHWAYS.find((p) => p.id === id) ?? null;

/** Where a step sends the member. `me` is the user id, for the portfolio link. */
export function linkOf(step, me) {
  switch (step.kind) {
    case 'rung':
      return step.url;
    case 'opp':
      return `/opportunities?q=${encodeURIComponent(step.match || step.type || '')}`;
    case 'comp':
      return '/competitions';
    case 'cycle':
    case 'project':
      return '/build';
    case 'starter':
      return `/build/start/${step.slug}`;
    case 'portfolio':
      return me ? `/u/${me}` : '/build';
    default:
      return step.url || '';
  }
}

/**
 * Is the step done by what the data already says? `facts` is gathered once
 * per member by the worker:
 *   rungs     Set of "track url" for done rungs      courses  Set of finished course slugs
 *   opps      [{ title, org, type }] saved or competed  comps   [name] on the roster
 *   entered, shipped, portfolio, signoff, record  booleans    projects  count
 */
export function autoDone(step, f) {
  const has = (s, needle) => String(s ?? '').toLowerCase().includes(String(needle).toLowerCase());
  switch (step.kind) {
    case 'rung':
      return f.rungs.has(`${step.track} ${step.url}`) || (step.url.startsWith('/learn/') && f.courses.has(step.url.slice(7)));
    case 'opp':
      return f.opps.some((o) => (!step.type || o.type === step.type) && (!step.match || has(o.title, step.match) || has(o.org, step.match)));
    case 'comp':
      return f.comps.some((n) => has(n, step.match ?? ''));
    case 'cycle':
      return step.need === 'ship' ? f.shipped : f.entered || f.shipped;
    case 'project':
      return f.projects > 0;
    case 'portfolio':
      return Boolean(f[step.need]);
    default:
      return false;
  }
}

/** Every step with its state. `ticks` is a Set of step ids the member ticked. */
export function stepStates(pathway, facts, ticks = new Set()) {
  return pathway.steps.map((s) => {
    const auto = autoDone(s, facts);
    const ticked = ticks.has(s.id);
    return { id: s.id, auto, ticked, done: auto || ticked };
  });
}

/**
 * The next step for Today, from the pathways a member follows (in the order
 * they followed them). Returns { pathway, step, n, total } or null.
 */
export function nextPathwayStep(followed, factsFor) {
  for (const { id, ticks } of followed) {
    const p = pathwayOf(id);
    if (!p) continue;
    const states = stepStates(p, factsFor, ticks);
    const i = states.findIndex((s) => !s.done);
    if (i >= 0) return { pathway: p, step: p.steps[i], n: i + 1, total: p.steps.length };
  }
  return null;
}
