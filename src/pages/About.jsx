import { TIERS } from '../lib/tiers.js';

/**
 * Renders the About text from settings. Supports "## heading", "- bullet", and
 * paragraphs -- enough for club copy, and cheaper than a markdown dependency.
 * Text is rendered as plain strings, never as HTML, so nothing typed into the
 * admin panel can inject markup.
 */
function RichText({ text = '' }) {
  const blocks = [];
  let list = null;

  const flush = () => {
    if (list) {
      blocks.push({ kind: 'list', items: list });
      list = null;
    }
  };

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (line.startsWith('## ')) {
      flush();
      blocks.push({ kind: 'h2', text: line.slice(3) });
    } else if (line.startsWith('- ')) {
      (list ??= []).push(line.slice(2));
    } else {
      flush();
      blocks.push({ kind: 'p', text: line });
    }
  }
  flush();

  return (
    <div className="grid gap-4">
      {blocks.map((b, i) => {
        if (b.kind === 'h2') {
          return (
            <h2 key={i} className="display mt-6 text-xl font-bold" style={{ color: 'var(--ink)' }}>
              {b.text}
            </h2>
          );
        }
        if (b.kind === 'list') {
          return (
            <ul key={i} className="grid gap-1.5">
              {b.items.map((item, j) => (
                <li key={j} className="flex gap-3 text-[0.92rem]" style={{ color: 'var(--ink-soft)' }}>
                  <span className="mono shrink-0" style={{ color: 'var(--flag)' }} aria-hidden="true">
                    ▸
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="text-[0.95rem] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            {b.text}
          </p>
        );
      })}
    </div>
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
        <article className="card p-6 sm:p-8">
          <RichText text={settings.about_body || ''} />
        </article>

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
