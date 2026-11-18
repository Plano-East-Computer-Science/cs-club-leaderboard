/**
 * Handoff (G4). Pure rules shared by the worker, the pages and the tests: the
 * school year, the officer-editable eligibility thresholds, and a function that
 * turns one member's record into a list of criteria met or not met.
 *
 * A school year runs from June to the next May (the same cut as shared/points.js
 * seasons, so fall and spring of one year always sit in one school year), and is
 * named by the year it starts: "2026" means 2026-27.
 */

/** Which school year a date falls in: '2026' for any day from 2026-06-01 to 2027-05-31. */
export function schoolYearOf(v) {
  const d = v instanceof Date ? v : new Date(typeof v === 'string' && !v.includes('T') && v.includes(' ') ? `${v.replace(' ', 'T')}Z` : v);
  return String(d.getUTCMonth() >= 5 ? d.getUTCFullYear() : d.getUTCFullYear() - 1);
}

/** [start, end) of a school year as SQLite UTC text, or null for a bad key. */
export function yearRange(year) {
  const y = Number(year);
  if (!/^\d{4}$/.test(String(year)) || y < 2000 || y > 2100) return null;
  return { start: `${y}-06-01 00:00:00`, end: `${y + 1}-06-01 00:00:00` };
}

/** "2026" -> "2026-27". */
export const yearLabel = (y) => `${y}-${String(Number(y) + 1).slice(2)}`;

/**
 * The criteria, in the order members see them. `have` comes from the record
 * (see gatherRecord in worker/hub/handoff.js); `need` from the thresholds.
 * A threshold of 0 switches that criterion off.
 */
export const CRITERIA = [
  { id: 'meetings', label: 'Meetings attended this year', field: 'meetings' },
  { id: 'mentor', label: 'Mentor activities (accepted editorials, helpful reviews, help queue)', field: 'mentor' },
  { id: 'content', label: 'Content authored (accepted editorials, live CTF challenges)', field: 'content' },
  { id: 'reviews', label: 'Code reviews given', field: 'reviews' },
  { id: 'hosted', label: 'Times you presented or helped run a meeting', field: 'hosted' },
];

export const DEFAULT_THRESHOLDS = { meetings: 8, mentor: 2, content: 1, reviews: 2, hosted: 1 };

/** Officer input to a clean thresholds object, or { error }. Whole numbers 0-100. */
export function cleanThresholds(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Thresholds must be an object.' };
  const out = {};
  for (const [k, v] of Object.entries(input)) {
    if (!(k in DEFAULT_THRESHOLDS)) return { error: `Unknown threshold "${k}".` };
    if (!Number.isInteger(v) || v < 0 || v > 100) return { error: `${k} must be a whole number from 0 to 100.` };
    out[k] = v;
  }
  return { thresholds: out };
}

/** Defaults with the saved setting (JSON text) merged over them. Bad JSON falls back to defaults. */
export function thresholdsFrom(saved) {
  let parsed = {};
  try {
    parsed = cleanThresholds(typeof saved === 'string' ? JSON.parse(saved) : saved ?? {}).thresholds ?? {};
  } catch {
    parsed = {};
  }
  return { ...DEFAULT_THRESHOLDS, ...parsed };
}

/**
 * record: { meetings, mentor, content, reviews, hosted } counts for one school year.
 * Returns { criteria: [{ id, label, have, need, met }], met, total, eligible }.
 * Switched-off criteria (need 0) are left out; with all of them off, nobody is
 * "eligible" by record alone (total 0), so officers decide by hand.
 */
export function eligibility(record = {}, thresholds = DEFAULT_THRESHOLDS) {
  const criteria = CRITERIA.filter((c) => (thresholds[c.id] ?? 0) > 0).map((c) => {
    const have = Math.max(0, Number(record[c.field]) || 0);
    const need = thresholds[c.id];
    return { id: c.id, label: c.label, have, need, met: have >= need };
  });
  const met = criteria.filter((c) => c.met).length;
  return { criteria, met, total: criteria.length, eligible: criteria.length > 0 && met === criteria.length };
}

export const APPLY_LIMITS = { answer: 600 };
/** The questions on the application form. Answers are short on purpose. */
export const QUESTIONS = [
  { id: 'why', label: 'Why do you want to help run the club?' },
  { id: 'plan', label: 'What is one thing you would change or start?' },
  { id: 'time', label: 'How much time can you give each week, and what else are you doing?' },
];

/** Clean one application's answers, or { error }. Every question needs an answer of at least 10 characters. */
export function cleanAnswers(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Answer the questions first.' };
  const out = {};
  for (const q of QUESTIONS) {
    const a = String(input[q.id] ?? '').replace(/\r/g, '').trim().slice(0, APPLY_LIMITS.answer);
    if (a.length < 10) return { error: `Give a short answer to: ${q.label}` };
    out[q.id] = a;
  }
  return { answers: out };
}
