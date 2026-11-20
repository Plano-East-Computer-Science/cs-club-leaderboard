/**
 * Where Home gets each door's "today" data. Each door owns its own logic and
 * exports one small function; Home only reads them here, so a door can change
 * how it works without Home changing.
 *
 * Until a door lands on `next`, its source returns an empty answer.
 */

/** Today's daily games, as a hook: [{ slug, name, done, href }]. Play door. */
export { usePlayToday } from '../play/today.js';

/** The lesson to continue, or null: { course, title, href, progress (0..1) }. Learn door. */
export const continueLesson = () => null;

import { getUpcoming } from '../future/upcoming.js';

/** The next few deadlines the student cares about: [{ title, due (YYYY-MM-DD), href }]. Future door. */
export const upcoming = async (signedIn = true) =>
  (await getUpcoming(4, { signedIn })).map((e) => ({ title: e.title, due: e.deadline, href: e.href }));
