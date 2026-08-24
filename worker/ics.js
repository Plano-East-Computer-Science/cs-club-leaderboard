/**
 * A minimal iCalendar (RFC 5545) generator.
 *
 * Just enough to publish a list of all-day deadline events as a feed a student
 * subscribes to once in Google Calendar, Apple Calendar, or Outlook. No
 * library needed -- the format is plain text with a handful of escaping and
 * line-length rules, and getting those right is the whole job.
 */

const CRLF = '\r\n';

/**
 * Escapes a TEXT value per RFC 5545 §3.3.11. Order matters: backslashes are
 * escaped first, or escaping the other characters would double-escape them.
 */
function escapeText(s = '') {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// Web-standard, not Node's Buffer -- this file runs in a Cloudflare Worker,
// which has no Node globals unless nodejs_compat is set (it isn't). Buffer
// would pass every test here (they run under plain Node) and then throw
// ReferenceError the moment it actually executed on Cloudflare.
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Folds a content line at 75 octets, as RFC 5545 §3.1 requires -- a line over
 * that length is split, and every continuation line starts with a single
 * space. Without this, a long description can be silently truncated or
 * rejected by a strict calendar client.
 */
function foldLine(line) {
  const bytes = encoder.encode(line);
  if (bytes.length <= 75) return line;

  const chunks = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    // Never split inside a multi-byte UTF-8 character: back off until the
    // byte at the cut point is not a continuation byte (0b10xxxxxx).
    let end = Math.min(start + limit, bytes.length);
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    chunks.push(decoder.decode(bytes.slice(start, end)));
    start = end;
    limit = 74; // continuation lines lose one column to their leading space
  }
  return chunks.join(CRLF + ' ');
}

const line = (name, value) => foldLine(`${name}:${value}`);

/** YYYYMMDD, the DATE form iCalendar wants for an all-day event. */
function asDate(iso) {
  return iso.replace(/-/g, '').slice(0, 8);
}

/** The day after a YYYY-MM-DD date, still as YYYYMMDD -- DTEND is exclusive. */
function dayAfter(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * @param {{id, title, org, url, deadline}[]} opportunities  only rows with a
 *   deadline should be passed in -- this function does not filter.
 * @param {{calName?: string, domain?: string}} [opts]
 */
export function opportunitiesToICS(opportunities, opts = {}) {
  const domain = opts.domain || 'peshcompsci.org';
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Plano East CS Club//Opportunity Deadlines//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    line('X-WR-CALNAME', escapeText(opts.calName || 'CS Club Opportunity Deadlines')),
    'X-WR-TIMEZONE:America/Chicago',
  ];

  for (const o of opportunities) {
    lines.push(
      'BEGIN:VEVENT',
      line('UID', `opp-${o.id}@${domain}`),
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${asDate(o.deadline)}`,
      `DTEND;VALUE=DATE:${dayAfter(o.deadline)}`,
      line('SUMMARY', escapeText(`Deadline: ${o.title}`)),
      line(
        'DESCRIPTION',
        escapeText([o.org, o.url].filter(Boolean).join(' -- '))
      )
    );
    if (o.url) lines.push(line('URL', escapeText(o.url)));
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join(CRLF) + CRLF;
}
