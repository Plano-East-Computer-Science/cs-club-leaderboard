import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { PageHeader, SectionTitle, RichText } from '../components/bits.jsx';
import { SubscribeBox } from '../components/Subscribe.jsx';

/**
 * The classroom setting is one free-text field an officer types into, and it
 * has held "Main CS - y27jjuq7 Cyber - zL4etzb6" style strings with no
 * separators between pairs. Split on newlines or commas, then pull every
 * "Name - CODE" pair out of each chunk. Codes are 5 to 8 alphanumerics.
 */
export function parseClassroomCodes(raw = '') {
  const rows = [];
  for (const chunk of raw.split(/[\n,]/)) {
    for (const m of chunk.matchAll(/([A-Za-z][A-Za-z ]*?)\s*-\s*([A-Za-z0-9]{5,8})/g)) {
      rows.push({ name: m[1].trim(), code: m[2] });
    }
  }
  return rows;
}

export default function Join({ settings }) {
  const classroom = settings.join_classroom_code?.trim() ?? '';
  const codes = parseClassroomCodes(classroom);

  return (
    <div>
      <PageHeader title="How to join">
        {settings.join_intro || 'Three steps, about five minutes. Then show up to a meeting.'}
      </PageHeader>

      <ol className="divide-y rounded-lg border bg-card">
        <Step n={1} title="Parent consent form" required>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            You cannot attend a meeting until this is turned in.
          </p>
          <div className="mt-4">
            {settings.join_consent_url ? (
              <a
                className="btn btn-primary"
                href={settings.join_consent_url}
                target="_blank"
                rel="noreferrer noopener"
              >
                Open the consent form
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            ) : (
              <p className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>
                Link not posted yet. Ask an officer.
              </p>
            )}
          </div>
        </Step>

        <Step n={2} title="Join the Google Classroom">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            Slides, problems, and competition signups all live there.
          </p>
          <div className="mt-4">
            {!classroom ? (
              <p className="mono text-xs" style={{ color: 'var(--ink-faint)' }}>
                Code coming soon. Ask an officer.
              </p>
            ) : codes.length === 0 ? (
              <code className="mono text-sm" style={{ color: 'var(--flag)' }}>
                {classroom}
              </code>
            ) : (
              <ul className="max-w-md divide-y rounded-md border">
                {codes.map((c) => (
                  <CodeRow key={c.code} name={c.name} code={c.code} />
                ))}
              </ul>
            )}
          </div>
        </Step>

        <Step n={3} title="Get the weekly email" id="subscribe">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            Points, new opportunities, and deadlines once a week. Use a personal address.
          </p>
          <div className="mt-4">
            <SubscribeBox id="join-subscribe" />
          </div>
        </Step>
      </ol>

      <section className="mt-12">
        <SectionTitle>Meetings</SectionTitle>
        {settings.join_meeting_info?.trim() ? (
          <div className="max-w-2xl">
            <RichText text={settings.join_meeting_info} />
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
            Day, time, and room are posted on Discord and in school announcements.
          </p>
        )}
      </section>
    </div>
  );
}

function Step({ n, title, required, id, children }) {
  return (
    <li id={id} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-2 p-5 sm:p-6">
      <span
        className="mono text-3xl leading-none font-bold"
        style={{ color: 'var(--flag)' }}
        aria-hidden="true"
      >
        {n}
      </span>
      <div className="min-w-0">
        <h2 className="display flex flex-wrap items-center gap-2 text-lg font-bold" style={{ color: 'var(--ink)' }}>
          {title}
          {required && (
            <span
              className="mono rounded-md px-1.5 py-0.5 text-xs font-semibold"
              style={{
                color: 'var(--danger)',
                background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
              }}
            >
              Required
            </span>
          )}
        </h2>
        <div className="mt-1.5">{children}</div>
      </div>
    </li>
  );
}

function CodeRow({ name, code }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
      <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
        {name}
      </span>
      <code className="mono text-sm" style={{ color: 'var(--flag)' }}>
        {code}
      </code>
      <button
        type="button"
        className="btn btn-ghost ml-auto"
        onClick={copy}
        aria-label={`Copy ${name} class code`}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </li>
  );
}
