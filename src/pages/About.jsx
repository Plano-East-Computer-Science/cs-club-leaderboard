import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { PageHeader, SectionTitle, RichText, Skeleton } from '../components/bits.jsx';

const COMMITTEE_LABEL = { main: 'Main CS Club', cyber: 'Cybersecurity Committee' };
const COMMITTEE_ORDER = ['main', 'cyber'];

/**
 * The seed body still carries a placeholder "## Officers" section from before
 * officers had their own table. Drop it so the real list below is the only one.
 */
function stripPlaceholderOfficers(body) {
  if (!body.includes('Add your officer list here')) return body;
  const lines = body.split('\n');
  const start = lines.findIndex((l) => l.trim() === '## Officers');
  if (start === -1) return body;
  let end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  if (end === -1) end = lines.length;
  return [...lines.slice(0, start), ...lines.slice(end)].join('\n');
}

export default function About({ settings }) {
  return (
    <div>
      <PageHeader title={settings.about_heading || 'About the club'} />

      <div className="max-w-2xl">
        <RichText text={stripPlaceholderOfficers(settings.about_body || '')} />
      </div>

      <Officers settings={settings} />
    </div>
  );
}

function Officers({ settings }) {
  const [officers, setOfficers] = useState(null);

  useEffect(() => {
    api.get('/officers').then((d) => setOfficers(d.officers)).catch(() => setOfficers([]));
  }, []);

  const groups = officers
    ? COMMITTEE_ORDER.map((c) => ({
        key: c,
        label: COMMITTEE_LABEL[c],
        rows: officers.filter((o) => o.committee === c),
      })).filter((g) => g.rows.length > 0)
    : [];
  // Anything with an unexpected committee still gets listed, at the end.
  const other = officers?.filter((o) => !COMMITTEE_ORDER.includes(o.committee)) ?? [];
  if (other.length) groups.push({ key: 'other', label: 'Other', rows: other });

  const contact = [
    settings.discord_url && { href: settings.discord_url, label: 'Join the Discord', external: true },
    settings.email && { href: `mailto:${settings.email}`, label: 'Email an officer' },
  ].filter(Boolean);

  if (officers && !officers.length && !contact.length) return null;

  return (
    <section className="mt-12 max-w-3xl">
      <SectionTitle>The officers</SectionTitle>

      {officers === null ? (
        <div className="grid gap-3" aria-busy="true" aria-label="Loading officers">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : officers.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
          Officer names go up here once the year starts.
        </p>
      ) : (
        groups.map((g) => (
          <div key={g.key} className="mb-6">
            <p className="mono mb-1 text-xs" style={{ color: 'var(--ink-faint)' }}>
              {g.label}
            </p>
            <ul className="divide-y">
              {g.rows.map((o, i) => (
                <li
                  key={o.id}
                  className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
                  style={{ animation: `row-in 0.35s ease-out ${Math.min(i * 0.03, 0.3)}s backwards` }}
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <span className="font-semibold" style={{ color: 'var(--ink)' }}>
                      {o.name}
                    </span>
                    <span className="mono text-xs" style={{ color: 'var(--flag)' }}>
                      {o.role}
                    </span>
                  </div>
                  {o.note && o.note !== COMMITTEE_LABEL[o.committee] && (
                    <span className="text-sm sm:max-w-[55%] sm:text-right" style={{ color: 'var(--ink-soft)' }}>
                      {o.note}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      {contact.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {contact.map((c) => (
            <a
              key={c.href}
              className="btn btn-ghost"
              href={c.href}
              target={c.external ? '_blank' : undefined}
              rel={c.external ? 'noreferrer noopener' : undefined}
            >
              {c.label}
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
