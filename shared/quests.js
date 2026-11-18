/**
 * Quests. Plain data plus one pure function, so the list is easy to read,
 * change in a pull request, and test.
 *
 * A quest is done when the member's activity says so (steps passed, meetings
 * joined, projects posted), so a new quest lights up for everyone who already
 * did the work. Since A4 there is no separate XP: finishing a quest records a
 * `quest` activity on the ledger (worker/hub/quests.js, syncQuests), which
 * pays the small, season-capped bonus in shared/points.js. Lessons are an
 * honour system, so quests can never decide the prize. Ranks live in
 * shared/ranks.js.
 */

/**
 * `have(stats)` returns progress toward `need`. Stats fields:
 *   steps, coursesDone, tracks, flags, meetings, projects, ideas, streak
 */
export const QUESTS = [
  // boot: the first ten minutes
  { id: 'first-step', line: 'boot', title: 'Hello, world', desc: 'Pass your first lesson step.', need: 1, have: (s) => s.steps, to: '/learn' },
  { id: 'first-room', line: 'boot', title: 'In the room', desc: 'Join a live meeting with the room code.', need: 1, have: (s) => s.meetings, to: '/room' },

  // regular: keep showing up
  { id: 'meet-3', line: 'regular', title: 'Showing up', desc: 'Check in to 3 meetings.', need: 3, have: (s) => s.meetings, to: '/room' },
  { id: 'meet-8', line: 'regular', title: 'Fixture', desc: 'Check in to 8 meetings.', need: 8, have: (s) => s.meetings, to: '/room' },
  { id: 'streak-3', line: 'regular', title: 'Warm streak', desc: 'Pass a step 3 days running.', need: 3, have: (s) => s.streak, to: '/learn' },

  // explorer: try more than one thing
  { id: 'course-1', line: 'explorer', title: 'Finisher', desc: 'Complete a whole course.', need: 1, have: (s) => s.coursesDone, to: '/learn' },
  { id: 'tracks-3', line: 'explorer', title: 'Sampler', desc: 'Pass a step in 3 different tracks.', need: 3, have: (s) => s.tracks, to: '/learn' },
  { id: 'course-4', line: 'explorer', title: 'Polymath', desc: 'Complete 4 courses.', need: 4, have: (s) => s.coursesDone, to: '/learn' },
  { id: 'flags-4', line: 'explorer', title: 'Flag hunter', desc: 'Capture 4 flags.', need: 4, have: (s) => s.flags, to: '/learn' },

  // builder: make something, say something
  { id: 'project-1', line: 'builder', title: 'Shipped', desc: 'Post a project to your portfolio.', need: 1, have: (s) => s.projects, to: '/projects' },
  { id: 'project-3', line: 'builder', title: 'Repeat offender', desc: 'Post 3 projects.', need: 3, have: (s) => s.projects, to: '/projects' },
  { id: 'idea-1', line: 'builder', title: 'Have a say', desc: 'Post an idea for the club.', need: 1, have: (s) => s.ideas, to: '/ideas' },
];

export const LINES = [
  { id: 'boot', name: 'Boot sequence', blurb: 'Your first ten minutes.' },
  { id: 'regular', name: 'Regular', blurb: 'Keep showing up.' },
  { id: 'explorer', name: 'Explorer', blurb: 'Try more than one thing.' },
  { id: 'builder', name: 'Builder', blurb: 'Make something. Say something.' },
];

/** stats -> { quests: [{ id, line, title, desc, need, have, done, to }] } */
export function questProgress(stats) {
  return {
    quests: QUESTS.map(({ have, ...q }) => {
      const n = Math.min(q.need, Math.max(0, Number(have(stats)) || 0));
      return { ...q, have: n, done: n >= q.need };
    }),
  };
}
