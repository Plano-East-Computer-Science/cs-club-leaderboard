/** Date helpers for the Club door, in the school's time zone (America/Chicago). */

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** Today in Chicago as YYYY-MM-DD. */
export function chicagoToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** The next date (today included) that falls on `dayName` ("Wednesday"), as YYYY-MM-DD. */
export function nextWeekday(dayName = 'Wednesday', today = chicagoToday()) {
  const want = DAYS.indexOf(String(dayName).toLowerCase());
  const d = new Date(`${today}T12:00:00Z`);
  if (want < 0) return today;
  while (d.getUTCDay() !== want) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const fmt = (date, opts) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', ...opts });
export const weekdayOf = (date) => fmt(date, { weekday: 'long' });
export const monthDay = (date) => fmt(date, { month: 'long', day: 'numeric' });
export const shortDay = (date) => fmt(date, { weekday: 'short', month: 'short', day: 'numeric' });

/** Whole days from today to `date` (0 = today). */
export function daysFromToday(date, today = chicagoToday()) {
  return Math.round((new Date(`${date}T12:00:00Z`) - new Date(`${today}T12:00:00Z`)) / 86400000);
}
