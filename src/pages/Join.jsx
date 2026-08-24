import { RichText } from '../components/bits.jsx';

export default function Join({ settings }) {
  const hasClassroom = Boolean(settings.join_classroom_code?.trim());

  return (
    <div>
      <header className="mb-10">
        <p className="eyebrow">Get involved</p>
        <h1 className="display mt-2 text-[clamp(2.2rem,6vw,3.5rem)] leading-[0.95] font-extrabold">
          How to join
        </h1>
        {settings.join_intro && (
          <p className="mt-4 max-w-2xl text-base" style={{ color: 'var(--ink-soft)' }}>
            {settings.join_intro}
          </p>
        )}
      </header>

      <div className="grid gap-5 sm:grid-cols-2">
        <StepCard
          step={1}
          required
          title="Parent consent form"
          body="You cannot attend meetings until this is submitted."
        >
          {settings.join_consent_url ? (
            <a
              className="btn btn-primary"
              href={settings.join_consent_url}
              target="_blank"
              rel="noreferrer noopener"
              style={{ textDecoration: 'none' }}
            >
              Open the consent form ↗
            </a>
          ) : (
            <p className="mono text-[0.7rem]" style={{ color: 'var(--ink-faint)' }}>
              Link not set yet — ask an officer.
            </p>
          )}
        </StepCard>

        <StepCard
          step={2}
          title="Google Classroom"
          body="Everything — slides, problems, competition signups — lives there."
        >
          {hasClassroom ? (
            <p className="mono rounded border px-3 py-2 text-sm font-semibold" style={{ color: 'var(--flag)' }}>
              {settings.join_classroom_code}
            </p>
          ) : (
            <p className="mono text-[0.7rem]" style={{ color: 'var(--ink-faint)' }}>
              Code coming soon — check back or ask an officer.
            </p>
          )}
        </StepCard>
      </div>

      <div className="card mt-6 p-5">
        <h2 className="eyebrow mb-3">Meeting</h2>
        {settings.join_meeting_info?.trim() ? (
          <RichText text={settings.join_meeting_info} />
        ) : (
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
            Day, time, and room haven't been posted here yet — ask an officer or check the
            school announcements.
          </p>
        )}
      </div>
    </div>
  );
}

function StepCard({ step, required, title, body, children }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2">
        <span
          className="mono grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.7rem] font-bold"
          style={{ background: 'var(--flag)', color: 'light-dark(#fff, #0d1017)' }}
        >
          {step}
        </span>
        <h2 className="display text-base font-bold" style={{ color: 'var(--ink)' }}>
          {title}
        </h2>
        {required && (
          <span
            className="mono ml-auto rounded px-1.5 py-0.5 text-[0.6rem] font-bold tracking-wide uppercase"
            style={{ color: '#c42e2e', background: 'color-mix(in srgb, #c42e2e 12%, transparent)' }}
          >
            Required
          </span>
        )}
      </div>
      <p className="mt-2 text-[0.85rem]" style={{ color: 'var(--ink-soft)' }}>
        {body}
      </p>
      <div className="mt-4">{children}</div>
    </div>
  );
}
