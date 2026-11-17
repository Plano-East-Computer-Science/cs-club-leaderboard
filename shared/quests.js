/**
 * Quests and ranks. Plain data plus two pure functions, so the rules are easy
 * to read, change in a pull request, and test.
 *
 * Nothing here is stored: a quest is done when the member's activity says so
 * (steps passed, meetings joined, projects posted). That means a new quest
 * lights up for everyone who already did the work, and there is nothing to
 * migrate when the list changes.
 *
 * XP is separate from leaderboard points on purpose. Points are awarded by
 * officers; XP is earned automatically, and code lessons are an honour system,
 * so XP must never be able to move the prize standings.
 */

/** Base XP for doing the things themselves. Quests add bonuses on top. */
export const XP = { step: 10, meeting: 30, project: 50, idea: 10 };

/** Site labels, lowest first. `min` is the XP needed. */
export const RANKS = [
  { id: 'guest', min: 0 },
  { id: 'recruit', min: 40 },
  { id: 'scripter', min: 150 },
  { id: 'builder', min: 350 },
  { id: 'hacker', min: 700 },
  { id: 'architect', min: 1200 },
  { id: 'root', min: 2000 },
];

/**
 * `have(stats)` returns progress toward `need`. Stats fields:
 *   steps, coursesDone, tracks, flags, meetings, projects, ideas, streak, linked
 */
export const QUESTS = [
  // boot: the first ten minutes
  { id: 'first-step', line: 'boot', title: 'Hello, world', desc: 'Pass your first lesson step.', xp: 20, need: 1, have: (s) => s.steps, to: '/learn' },
  { id: 'link', line: 'boot', title: 'On the board', desc: 'Connect your account to your leaderboard entry.', xp: 20, need: 1, have: (s) => (s.linked ? 1 : 0), to: '/' },
  { id: 'first-room', line: 'boot', title: 'In the room', desc: 'Join a live meeting with the room code.', xp: 30, need: 1, have: (s) => s.meetings, to: '/room' },

  // regular: keep showing up
  { id: 'meet-3', line: 'regular', title: 'Showing up', desc: 'Check in to 3 meetings.', xp: 60, need: 3, have: (s) => s.meetings, to: '/room' },
  { id: 'meet-8', line: 'regular', title: 'Fixture', desc: 'Check in to 8 meetings.', xp: 150, need: 8, have: (s) => s.meetings, to: '/room' },
  { id: 'streak-3', line: 'regular', title: 'Warm streak', desc: 'Pass a step 3 days running.', xp: 40, need: 3, have: (s) => s.streak, to: '/learn' },

  // explorer: try more than one thing
  { id: 'course-1', line: 'explorer', title: 'Finisher', desc: 'Complete a whole course.', xp: 60, need: 1, have: (s) => s.coursesDone, to: '/learn' },
  { id: 'tracks-3', line: 'explorer', title: 'Sampler', desc: 'Pass a step in 3 different tracks.', xp: 60, need: 3, have: (s) => s.tracks, to: '/learn' },
  { id: 'course-4', line: 'explorer', title: 'Polymath', desc: 'Complete 4 courses.', xp: 200, need: 4, have: (s) => s.coursesDone, to: '/learn' },
  { id: 'flags-4', line: 'explorer', title: 'Flag hunter', desc: 'Capture 4 flags.', xp: 50, need: 4, have: (s) => s.flags, to: '/learn' },

  // builder: make something, say something
  { id: 'project-1', line: 'builder', title: 'Shipped', desc: 'Post a project to your portfolio.', xp: 80, need: 1, have: (s) => s.projects, to: '/projects' },
  { id: 'project-3', line: 'builder', title: 'Repeat offender', desc: 'Post 3 projects.', xp: 200, need: 3, have: (s) => s.projects, to: '/projects' },
  { id: 'idea-1', line: 'builder', title: 'Have a say', desc: 'Post an idea for the club.', xp: 20, need: 1, have: (s) => s.ideas, to: '/ideas' },
];

export const LINES = [
  { id: 'boot', name: 'Boot sequence', blurb: 'Your first ten minutes.' },
  { id: 'regular', name: 'Regular', blurb: 'Keep showing up.' },
  { id: 'explorer', name: 'Explorer', blurb: 'Try more than one thing.' },
  { id: 'builder', name: 'Builder', blurb: 'Make something. Say something.' },
];

export function rankFor(xp) {
  let i = 0;
  RANKS.forEach((r, k) => {
    if (xp >= r.min) i = k;
  });
  return { rank: RANKS[i].id, next: RANKS[i + 1] ?? null };
}

/** stats -> { xp, rank, next, quests: [{ id, line, title, desc, xp, need, have, done, to }] } */
export function questProgress(stats) {
  const quests = QUESTS.map(({ have, ...q }) => {
    const n = Math.min(q.need, Math.max(0, Number(have(stats)) || 0));
    return { ...q, have: n, done: n >= q.need };
  });
  const xp =
    stats.steps * XP.step +
    stats.meetings * XP.meeting +
    stats.projects * XP.project +
    Math.min(stats.ideas, 5) * XP.idea + // capped so posting ideas is not a grind
    quests.filter((q) => q.done).reduce((a, q) => a + q.xp, 0);
  return { xp, ...rankFor(xp), quests };
}
