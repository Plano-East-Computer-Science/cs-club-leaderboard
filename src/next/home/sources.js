/**
 * Where Home gets each door's "today" data. Each door owns its own logic and
 * exports one small function; Home only reads them here, so a door can change
 * how it works without Home changing.
 */
import { getUpcoming } from '../future/upcoming.js';
import { getContinue } from '../learn/progress.js';

/** Today's daily games, as a hook: [{ slug, name, done, href }]. Play door. */
export { usePlayToday } from '../play/today.js';

/** The lesson to continue, or null: { course, title, href, progress (0..1), started }. Learn door. */
export async function continueLesson() {
  const c = await getContinue();
  return c && { course: `${c.courseTitle}, ${c.unitTitle}`, title: c.title, href: c.href, progress: c.total ? c.done / c.total : 0, started: c.started || c.done > 0 };
}

/** The next few deadlines the student cares about: [{ title, due (YYYY-MM-DD), href }]. Future door. */
export const upcoming = async (signedIn = true) =>
  (await getUpcoming(4, { signedIn })).map((e) => ({ title: e.title, due: e.deadline, href: e.href }));
