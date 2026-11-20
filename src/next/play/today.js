/**
 * Today's games for other pages (Home shows them). Light: no game content is
 * imported, only the list of games and the local results.
 *
 *   const games = usePlayToday(); // [{ slug, name, done, href }]
 */
import { GAMES, chicagoDate } from '../../../shared/next/play/core.js';
import { keyOf, useResults } from './store.js';

export function playToday(results, today = chicagoDate()) {
  return GAMES.map((g) => {
    const r = results[keyOf(g.slug, today)];
    return { slug: g.slug, name: g.name, blurb: g.blurb, tile: g.tile, done: Boolean(r), score: r?.score ?? null, href: `/play/${g.slug}` };
  });
}

export function usePlayToday() {
  return playToday(useResults());
}
