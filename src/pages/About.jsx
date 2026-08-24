import { useEffect, useState } from 'react';
import { TIERS } from '../lib/tiers.js';
import { api } from '../lib/api.js';
import { RichText, Spinner } from '../components/bits.jsx';

const COMMITTEE_LABEL = { main: 'Main CS Club', cyber: 'Cybersecurity Committee' };

function Officers() {
  const [officers, setOfficers] = useState(null);

  useEffect(() => {
    api.get('/officers').then((d) => setOfficers(d.officers)).catch(() => setOfficers([]));
  }, []);

  if (officers === null) return <Spinner label="Loading officers" />;
  if (!officers.length) return null;

  return (
    <section>
      <h2 className="display mb-4 text-xl font-bold" style={{ color: 'var(--ink)' }}>
        The officers
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {officers.map((o) => (
          <li key={o.id} className="card p-4">
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              {o.name}
            </p>
            <p className="mono mt-0.5 text-[0.7rem]" style={{ color: 'var(--flag)' }}>
              {o.role}
            </p>
            {o.note && (
              <p className="mt-1.5 text-[0.8rem]" style={{ color: 'var(--ink-soft)' }}>
                {o.note}
              </p>
            )}
            <p className="mono mt-2 text-[0.65rem]" style={{ color: 'var(--ink-faint)' }}>
              {COMMITTEE_LABEL[o.committee] ?? o.committee}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function About({ settings }) {
  return (
    <div>
      <header className="mb-10">
        <p className="eyebrow">{settings.school_name || 'Plano East Senior High School'}</p>
        <h1 className="display mt-2 text-[clamp(2.2rem,6vw,3.5rem)] leading-[0.95] font-extrabold">
          {settings.about_heading || 'About the club'}
        </h1>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_18rem] lg:items-start">
        <div className="grid gap-8">
          <article className="card p-6 sm:p-8">
            <RichText text={settings.about_body || ''} />
          </article>
          <Officers />
        </div>

        <aside className="grid gap-6">
          <div className="card p-5">
            <h2 className="eyebrow mb-3">The tier ladder</h2>
            <ol className="grid gap-2">
              {TIERS.map((t) => (
                <li key={t.name} className="mono flex items-center gap-2 text-xs">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ background: t.color }}
                    aria-hidden="true"
                  />
                  <span className="font-semibold" style={{ color: t.color }}>
                    {t.name}
                  </span>
                  <span className="ml-auto" style={{ color: 'var(--ink-faint)' }}>
                    {t.min}+
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {(settings.discord_url || settings.email) && (
            <div className="card p-5">
              <h2 className="eyebrow mb-3">Get in</h2>
              <div className="grid gap-2">
                {settings.discord_url && (
                  <a
                    className="btn btn-primary"
                    href={settings.discord_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    style={{ textDecoration: 'none' }}
                  >
                    Join the Discord
                  </a>
                )}
                {settings.email && (
                  <a className="btn btn-ghost" href={`mailto:${settings.email}`} style={{ textDecoration: 'none' }}>
                    Email an officer
                  </a>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
