/**
 * The member doors (v2-spec section 3) and which old routes live behind
 * each one, so the right door lights up on every existing page.
 */
import { House, GameController, Code, Hammer, Trophy, UserCircle } from '@phosphor-icons/react';

const under = (p, list) => list.some((x) => p === x || p.startsWith(`${x}/`));

export const DOORS = [
  { id: 'today', label: 'Today', to: '/', icon: House, match: (p) => p === '/' },
  { id: 'play', label: 'Play', to: '/play', icon: GameController, match: (p) => under(p, ['/play']) },
  {
    id: 'practice',
    label: 'Practice',
    to: '/practice',
    icon: Code,
    match: (p) => under(p, ['/practice', '/arena', '/p', '/daily', '/learn', '/puzzles', '/research', '/curriculum']),
  },
  {
    id: 'build',
    label: 'Build',
    to: '/build',
    icon: Hammer,
    match: (p) => under(p, ['/build', '/workspace', '/gateway', '/read', '/projects', '/ideas']),
  },
  {
    id: 'compete',
    label: 'Compete',
    to: '/compete',
    icon: Trophy,
    match: (p) => under(p, ['/compete', '/standings', '/student', '/competitions', '/opportunities', '/calendar', '/cyber']),
  },
  {
    id: 'me',
    label: 'Me',
    to: '/me',
    icon: UserCircle,
    match: (p) => under(p, ['/me', '/u', '/quests', '/pathways', '/compass', '/officers/apply', '/alumni', '/signin']),
  },
];

export const doorOf = (pathname) => DOORS.find((d) => d.match(pathname)) ?? null;
