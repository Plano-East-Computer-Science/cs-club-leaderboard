/**
 * Meeting planner (G1): pure rules shared by the worker and the officer screen.
 *
 * A plan is { id, date, title, template, blocks, ideaId, roomCode }. Officers see
 * all of it. Members see publicPlan(): date, title, kind and the agenda's
 * type, title and minutes. Block notes and lab tiers are officer prep (they can
 * hold answers, names, "ask Sam to go first") and never leave the officer routes.
 */
import { BLOCK_LABEL, TEMPLATES } from './session-templates.js';

export const kindName = (template) => TEMPLATES[template]?.name ?? 'Meeting';

/** True for a real calendar date written YYYY-MM-DD. */
export function validDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** "Tue, Nov 24" for a YYYY-MM-DD date. */
export const whenLabel = (date) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

/**
 * Warns when the three meetings before `plan` were all the same kind as it.
 * `timeline` is [{ date, template, planId }]: held rooms plus planned sessions
 * that have no room yet (a held plan is already in as its room). Drop-ins are
 * not meetings and are left out by the caller. Returns a sentence or null.
 */
export function varietyWarning(timeline, plan) {
  const prior = timeline
    .filter((e) => e.template && e.date < plan.date && !(plan.id != null && e.planId === plan.id))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .slice(-3);
  if (prior.length < 3 || prior.some((e) => e.template !== plan.template)) return null;
  return `The last 3 meetings were all ${kindName(plan.template)}. Consider a different kind.`;
}

/** The member-facing view of a plan. An allow-list, so a new field is private until added here. */
export function publicPlan(p) {
  return {
    id: p.id,
    date: p.date,
    title: p.title,
    template: p.template,
    kind: kindName(p.template),
    held: Boolean(p.roomCode),
    agenda: (p.blocks ?? []).map((b) => ({ type: BLOCK_LABEL[b.type] ?? b.type, title: b.title, minutes: b.minutes })),
  };
}
