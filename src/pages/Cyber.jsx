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
import { RichText, Spinner } from '../components/bits.jsx';
import { formatDate } from '../lib/format.js';

/**
 * Fallback copy, straight from the club's intro deck. The admin panel's Page
 * text tab overrides it; this is what shows until someone edits it, so the
 * page is never blank on a database that predates the setting.
 */
const DEFAULT_BODY = `The Cybersecurity Committee is the offensive-and-defensive half of the club. You do not need programming experience to start — the first few weeks assume none.

## What we actually do
- Capture the Flag competitions: picoCTF, CyberPatriot, and smaller weekly challenges
- Weekly lectures paired with a hands-on lab, so nothing stays theoretical
- Systems programming in Rust — memory safety from the inside out
- Malware analysis: what a real sample does, in an environment where it cannot do it to you

## Rules of the road
We break into things we are allowed to break into. Everything we practise on is a lab, a competition box, or our own machines. Doing it anywhere else is a felony and gets you removed from the club — not a metaphor, an actual law.

## Getting started
Show up. Bring a laptop if you have one; if you do not, say so and we will pair you with someone who does.`;

const CYBER_TYPES = /ctf|cyber|security|hack/i;

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
      <header className="mb-10">
        <p className="eyebrow">Committee</p>
        <h1 className="display mt-2 text-[clamp(2.2rem,6vw,3.5rem)] leading-[0.95] font-extrabold">
          Cybersecurity.
        </h1>
        <p className="mt-4 max-w-2xl text-base" style={{ color: 'var(--ink-soft)' }}>
          {settings.cyber_intro ||
            'Capture the Flag, systems programming, and taking things apart to find out how they broke.'}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_18rem] lg:items-start">
        <section className="card p-6 sm:p-8">
          <RichText text={settings.cyber_body || DEFAULT_BODY} />
        </section>

        <aside className="grid gap-4">
          {officers === null ? (
            <Spinner label="Loading" />
          ) : (
            officers.length > 0 && (
              <div className="card p-5">
                <h2 className="eyebrow mb-3">Who runs it</h2>
                <ul className="grid gap-2">
                  {officers.map((o) => (
                    <li key={o.id}>
                      <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                        {o.name}
                      </p>
                      <p className="mono text-[0.7rem]" style={{ color: 'var(--ink-faint)' }}>
                        {o.role}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}

          {opps.length > 0 && (
              <div className="card p-5">
                <h2 className="eyebrow mb-3">Cyber on the board</h2>
                <ul className="grid gap-2.5">
                  {opps.map((o) => (
                    <li key={o.id} className="text-[0.82rem]">
                      <a
                        href={o.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        style={{ color: 'var(--ink)' }}
                      >
                        {o.title}
                      </a>
                      {o.deadline && (
                        <p className="mono text-[0.65rem]" style={{ color: 'var(--ink-faint)' }}>
                          due {formatDate(o.deadline)}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
                <Link
                  className="mono mt-4 inline-block text-[0.7rem] no-underline"
                  style={{ color: 'var(--flag)' }}
                  to="/opportunities"
                >
                  The whole board →
                </Link>
              </div>
          )}
        </aside>
      </div>
    </div>
  );
}
