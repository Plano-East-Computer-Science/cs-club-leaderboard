/**
 * The student's next few deadlines, for the Home page: tracker items plus
 * saved live opportunities that are not already in the tracker.
 *
 *   const list = await getUpcoming(4, { signedIn: Boolean(user) });
 *   // [{ id, title, deadline: 'YYYY-MM-DD', days, href, source: 'tracker' | 'saved' }]
 *
 * Pass signedIn so a signed-out visitor does not trigger 401s.
 */
import { api } from '../../lib/api.js';
import { mergeItems, todayIn, upcoming } from '../../../shared/next/future/tracker.js';
import { localItems, readSaved } from './store.js';

export async function getUpcoming(n = 5, { signedIn = false } = {}) {
  const [opps, interest, remote] = await Promise.all([
    api.get('/opportunities').then((r) => r.opportunities ?? []).catch(() => []),
    signedIn ? api.get('/opp-interest').catch(() => ({ mine: [] })) : { mine: [] },
    signedIn ? api.get('/future/tracker').then((r) => r.items).catch(() => []) : [],
  ]);
  const items = mergeItems(localItems(), remote);
  const saved = new Set([...readSaved(), ...(interest.mine ?? [])]);
  const tracked = new Set(items.map((i) => i.ref).filter(Boolean));
  const entries = [
    ...items.map((i) => ({ id: i.id, title: i.title, deadline: i.deadline, status: i.status, href: '/future/tracker', source: 'tracker' })),
    ...opps
      .filter((o) => saved.has(o.id) && !tracked.has(`opp:${o.id}`) && o.deadline)
      .map((o) => ({ id: `opp-${o.id}`, title: o.title, deadline: String(o.deadline).slice(0, 10), href: '/future', source: 'saved' })),
  ];
  return upcoming(entries, todayIn(), n).map(({ status, ...e }) => e);
}
