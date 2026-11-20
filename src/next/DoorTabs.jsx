/**
 * One tab bar per door, rendered by a layout route, so every sub-page of a door
 * keeps the same tabs and any tab can be clicked again from anywhere inside it.
 * (The old Me page linked out to other pages and its buttons vanished.)
 */
import { Outlet } from 'react-router-dom';
import { NavTabs } from '../ui/index.js';

export const DOOR_TABS = {
  learn: [
    { to: '/learn', label: 'Courses' },
    { to: '/practice', label: 'Practice' },
    { to: '/daily', label: 'Daily problem' },
    { to: '/build', label: 'Projects' },
    { to: '/arena', label: 'Arena', end: true },
  ],
  future: [
    { to: '/future', label: 'Opportunities', end: true },
    { to: '/future/college', label: 'College plan' },
    { to: '/future/tracker', label: 'My tracker' },
    { to: '/competitions', label: 'Competitions' },
    { to: '/calendar', label: 'Calendar' },
  ],
  club: [
    { to: '/club', label: 'Meetings', end: true },
    { to: '/compete', label: 'Standings' },
    { to: '/club/playbook', label: 'Playbook' },
    { to: '/ideas', label: 'Ideas' },
    { to: '/about', label: 'About' },
  ],
  me: [
    { to: '/me', label: 'Overview', end: true },
    { to: '/me/points', label: 'Points' },
    { to: '/quests', label: 'Quests' },
    { to: '/pathways', label: 'Goals' },
    { to: '/me/account', label: 'Account' },
  ],
};

const LABEL = { learn: 'Learn', future: 'Future', club: 'Club', me: 'Me' };

export function DoorLayout({ door }) {
  return (
    <>
      <NavTabs label={LABEL[door]} items={DOOR_TABS[door]} />
      <Outlet />
    </>
  );
}
