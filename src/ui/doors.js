/**
 * The doors of the `next` site (one per job a student comes for) and which
 * routes live behind each, so the right door lights up on every page.
 * Each door's sub-pages share one tab bar (src/next/DoorTabs.jsx), so moving
 * between them never loses the way back.
 */
import { House, GameController, BookOpenText, RocketLaunch, UsersThree, UserCircle } from '@phosphor-icons/react';

const under = (p, list) => list.some((x) => p === x || p.startsWith(`${x}/`));

export const DOORS = [
  { id: 'home', label: 'Home', to: '/', icon: House, match: (p) => p === '/' },
  { id: 'play', label: 'Play', to: '/play', icon: GameController, match: (p) => under(p, ['/play', '/puzzles']) },
  {
    id: 'learn',
    label: 'Learn',
    to: '/learn',
    icon: BookOpenText,
    match: (p) => under(p, ['/learn', '/practice', '/arena', '/p', '/daily', '/research', '/curriculum', '/build', '/workspace', '/lab', '/read', '/gateway']),
  },
  {
    id: 'future',
    label: 'Future',
    to: '/future',
    icon: RocketLaunch,
    match: (p) => under(p, ['/future', '/opportunities', '/calendar', '/pathways', '/compass', '/competitions', '/cyber']),
  },
  {
    id: 'club',
    label: 'Club',
    to: '/club',
    icon: UsersThree,
    match: (p) => under(p, ['/club', '/compete', '/standings', '/student', '/room', '/recap', '/ideas', '/alumni', '/about', '/archive', '/parents']),
  },
  { id: 'me', label: 'Me', to: '/me', icon: UserCircle, match: (p) => under(p, ['/me', '/u', '/quests', '/officers/apply', '/signin']) },
];

export const doorOf = (pathname) => DOORS.find((d) => d.match(pathname)) ?? null;
