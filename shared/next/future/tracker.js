/**
 * The student's tracker: one item per opportunity or application they are
 * pursuing. Pure logic shared by the page (localStorage) and the API
 * (worker/hub/future.js), so both validate the same way.
 */

export const STATUSES = ['interested', 'preparing', 'applied', 'result'];
export const STATUS_LABEL = { interested: 'Interested', preparing: 'Preparing', applied: 'Applied', result: 'Result' };
export const DEFAULT_CHECKLIST = ['Essay', 'Recommendation', 'Transcript'];

export const LIMITS = { items: 150, title: 120, notes: 2000, checklist: 20, checkText: 80, url: 300, outcome: 60, bytes: 8000 };

const ID = /^[a-z0-9-]{4,40}$/;
const REF = /^(opp:\d{1,9}|prog:[a-z0-9-]{1,36})$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date in YYYY-MM-DD form. */
export function isDate(s) {
  if (typeof s !== 'string' || !DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * Validates and normalises one item. Returns { item } or { error } with a
 * sentence a student can read. Unknown fields are dropped.
 */
export function cleanItem(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'Send an item.' };
  const id = str(raw.id);
  if (!ID.test(id)) return { error: 'That item id is not valid.' };
  const title = str(raw.title);
  if (!title) return { error: 'Give it a name.' };
  if (title.length > LIMITS.title) return { error: `Keep the name under ${LIMITS.title} characters.` };
  const status = raw.status ?? 'interested';
  if (!STATUSES.includes(status)) return { error: 'Pick a status from the list.' };
  const deadline = str(raw.deadline);
  if (deadline && !isDate(deadline)) return { error: 'The deadline must be a real date.' };
  const notes = typeof raw.notes === 'string' ? raw.notes : '';
  if (notes.length > LIMITS.notes) return { error: `Notes can be up to ${LIMITS.notes} characters.` };
  const url = str(raw.url);
  if (url && (url.length > LIMITS.url || !/^https?:\/\/[^\s]+$/i.test(url))) return { error: 'The link must start with http:// or https://.' };
  const ref = str(raw.ref);
  if (ref && !REF.test(ref)) return { error: 'That source reference is not valid.' };
  const outcome = str(raw.outcome);
  if (outcome.length > LIMITS.outcome) return { error: `Keep the result under ${LIMITS.outcome} characters.` };
  const list = raw.checklist ?? [];
  if (!Array.isArray(list)) return { error: 'The checklist must be a list.' };
  if (list.length > LIMITS.checklist) return { error: `A checklist can have up to ${LIMITS.checklist} steps.` };
  const checklist = [];
  for (const c of list) {
    const text = str(c?.text);
    if (!text) return { error: 'Every checklist step needs text.' };
    if (text.length > LIMITS.checkText) return { error: `Keep each checklist step under ${LIMITS.checkText} characters.` };
    checklist.push({ text, done: c.done === true });
  }
  const updatedAt = Number.isFinite(raw.updatedAt) && raw.updatedAt > 0 ? Math.floor(raw.updatedAt) : 0;
  return { item: { id, title, status, deadline, notes, url, ref, outcome, checklist, updatedAt } };
}

/** A fresh item id: time plus randomness, safe for both stores. */
export const newId = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Whole days from `today` to `date` (both YYYY-MM-DD). Negative once passed. */
export function daysBetween(today, date) {
  if (!isDate(today) || !isDate(date)) return null;
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

/** Today's date in the club's timezone, YYYY-MM-DD. */
export const todayIn = (tz = 'America/Chicago', now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);

/**
 * The next deadlines from any list of { title, deadline } entries: drops
 * past or missing dates and items already decided, soonest first, ties by
 * title so the order is stable.
 */
export function upcoming(entries, today, n = 5) {
  return entries
    .filter((e) => e.deadline && isDate(e.deadline) && e.deadline >= today && e.status !== 'result')
    .map((e) => ({ ...e, days: daysBetween(today, e.deadline) }))
    .sort((a, b) => a.deadline.localeCompare(b.deadline) || String(a.title).localeCompare(String(b.title)))
    .slice(0, n);
}

/** Merges two item lists by id; the newer `updatedAt` wins. Keeps local order first. */
export function mergeItems(local, remote) {
  const out = new Map();
  for (const it of [...local, ...remote]) {
    const have = out.get(it.id);
    if (!have || (it.updatedAt ?? 0) > (have.updatedAt ?? 0)) out.set(it.id, it);
  }
  return [...out.values()];
}

/** "Due today", "Due tomorrow", "In 12 days", "Closed". */
export function countdown(days) {
  if (days == null) return 'No deadline';
  if (days < 0) return 'Closed';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `In ${days} days`;
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** The next 'Nov 1'-style date on or after `today` (YYYY-MM-DD), as YYYY-MM-DD; '' if unreadable. */
export function nextDateOf(label, today) {
  const m = /^([A-Z][a-z]{2}) (\d{1,2})$/.exec(label ?? '');
  const mi = m ? MON.indexOf(m[1]) : -1;
  if (mi < 0 || !isDate(today)) return '';
  const pad = (n) => String(n).padStart(2, '0');
  let y = Number(today.slice(0, 4));
  let d = `${y}-${pad(mi + 1)}-${pad(Number(m[2]))}`;
  if (d < today) d = `${++y}-${pad(mi + 1)}-${pad(Number(m[2]))}`;
  return isDate(d) ? d : '';
}

/** Months from `month0` (0-11, now) until a typical deadline month (1-12); 0 means this month. */
export const monthsUntil = (month0, month) => (month - 1 - month0 + 12) % 12;
