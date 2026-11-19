/**
 * GET /api/club (V3-A): meeting day, time and place, the next session, and the
 * points table from shared/points.js. One source, so pages never disagree.
 */
import { useApi } from './ui.js';

export const useClub = () => useApi('/club').data;

/** "Tuesdays, 4:15 pm, Room 2104", or '' when an officer has not set it yet. */
export const meetingLine = (m) => [m?.day, m?.time, m?.place].filter(Boolean).join(', ');

/** Points for one kind from the table, or null if the table has not loaded. */
export const pointsOf = (club, kind) => club?.points.find((p) => p.kind === kind)?.points ?? null;
