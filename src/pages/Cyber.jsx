/**
 * The Cybersecurity Committee.
 *
 * A recruiting page: 8 of 23 people who filled in the interest form said a
 * firm yes to cyber. The listings on the side are the existing opportunity
 * board filtered, not a second copy.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { PageHeader, RichText, Skeleton } from '../components/bits.jsx';
import { formatDate } from '../lib/format.js';

/**
 * Fallback copy, straight from the club's intro deck. The cyber_body setting
 * overrides it; this is what shows until someone edits it, so the page is
 * never blank on a database that predates the setting.
 */
const DEFAULT_BODY = `The Cybersecurity Committee is the offensive-and-defensive half of the club. You do not need programming experience to start. The first few weeks assume none.

## What we actually do
- Capture the Flag competitions: picoCTF, CyberPatriot, and smaller weekly challenges
- Weekly lectures paired with a hands-on lab, so nothing stays theoretical
- Systems programming in Rust: memory safety from the inside out
- Malware analysis: what a real sample does, in an environment where it cannot do it to you

## Rules of the road
We break into things we are allowed to break into. Everything we practice on is a lab, a competition box, or our own machines. Doing it anywhere else is a felony and gets you removed from the club. Not a metaphor, an actual law.

## Getting started
Show up. Bring a laptop if you have one; if you do not, say so and we will pair you with someone who does.`;

// Hackathons and "Hack Club" are not cyber, so no bare "hack".
const CYBER_TYPES = /\bctf\b|cyber|security|pico/i;

const PANEL = {
  background: 'color-mix(in srgb, var(--flag) 8%, var(--card))',
};

export default function Cyber({ settings }) {
  const [officers, setOfficers] = useState(null);
  const [opps, setOpps] = useState([]);

  useEffect(() => {
    api
      .get('/officers')
      .then((d) => setOfficers(d.officers.filter((o) => o.committee === 'cyber')))
      .catch(() => setOfficers([]));
  }, []);

  useEffect(() => {
    api
      .get('/opportunities')
      .then((d) =>
        setOpps(
          d.opportunities.filter((o) => CYBER_TYPES.test(`${o.title} ${o.org ?? ''} ${o.description ?? ''}`))
        )
      )
      .catch(() => setOpps([]));
  }, []);

  return (
    <div>
      <PageHeader title="Cybersecurity">
        {settings.cyber_intro ||
          'Capture the Flag, systems programming, and taking things apart to find out how they broke.'}
      </PageHeader>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="max-w-2xl">
          <RichText text={settings.cyber_body || DEFAULT_BODY} />
        </div>

        <aside className="grid gap-4">
          <div className="rounded-lg border p-4" style={PANEL}>
            <h2 className="display text-base font-bold" style={{ color: 'var(--ink)' }}>
              Who runs it
            </h2>
            {officers === null ? (
              <div className="mt-3 grid gap-2" aria-busy="true" aria-label="Loading officers">
                <Skeleton className="h-9" />
                <Skeleton className="h-9" />
              </div>
            ) : officers.length === 0 ? (
              <p className="mt-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
                Officer names go up here once the year starts.
              </p>
            ) : (
              <ul className="mt-2 divide-y">
                {officers.map((o) => (
                  <li key={o.id} className="py-2">
                    <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                      {o.name}
                    </p>
                    <p className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>
                      {o.role}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border p-4" style={PANEL}>
            <h2 className="display text-base font-bold" style={{ color: 'var(--ink)' }}>
              Cyber on the board
            </h2>
            {opps.length === 0 ? (
              <p className="mt-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
                No cyber listings right now. New ones show up here as officers post them.
              </p>
            ) : (
              <ul className="mt-2 divide-y">
                {opps.map((o) => (
                  <li key={o.id} className="py-2">
                    <a
                      href={o.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-sm font-semibold no-underline hover:underline"
                      style={{ color: 'var(--ink)' }}
                      aria-label={`Open ${o.title}`}
                    >
                      {o.title}
                    </a>
                    {o.deadline && (
                      <p className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>
                        due {formatDate(o.deadline)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <Link
              className="mono mt-3 inline-block text-xs font-semibold no-underline hover:underline"
              style={{ color: 'var(--flag)' }}
              to="/opportunities"
            >
              The whole board
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
