/** Small display helpers shared across pages. */

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function relativeDate(iso) {
  if (!iso) return '';
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return '';
  const days = Math.round((d - new Date()) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  if (days > 0) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}

/** Days until a deadline, or null when there is no deadline. */
export function daysUntil(iso) {
  if (!iso) return null;
  const d = new Date(`${iso}T23:59:59`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d - new Date()) / 86_400_000);
}

export const TYPE_LABELS = {
  internship: 'Internship',
  competition: 'Competition',
  program: 'Program',
  resource: 'Resource',
  scholarship: 'Scholarship',
};

export const FORMAT_LABELS = {
  online: 'Online',
  local: 'Near Plano',
  residential: 'Residential',
};

export const COST_LABELS = {
  free: 'Free',
  paid: 'Costs money',
  stipend: 'Paid to you',
};
