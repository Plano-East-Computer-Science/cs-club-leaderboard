/**
 * Renders the playbook's tiny markdown subset (shared/next/club/playbook.js):
 * paragraphs, "- " lists, "> " template blocks with a Copy button, **bold** and
 * `code` inline. Text only, never HTML, so authored content cannot inject markup.
 */
import { useState } from 'react';
import { Copy, Check } from '@phosphor-icons/react';

function inline(text) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    out.push(t.startsWith('**') ? <strong key={m.index}>{t.slice(2, -2)}</strong> : <code key={m.index}>{t.slice(1, -1)}</code>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function CopyBlock({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1600);
    } catch {
      /* clipboard blocked: the text is still selectable */
    }
  };
  return (
    <div className="cl-copy">
      <p>{text}</p>
      <button type="button" className="cl-copy__b" onClick={copy}>
        {done ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
        <span>{done ? 'Copied' : label}</span>
      </button>
    </div>
  );
}

export default function Prose({ text }) {
  const blocks = String(text).split(/\n\s*\n/);
  return (
    <div className="cl-prose">
      {blocks.map((b, i) => {
        const lines = b.split('\n');
        if (lines.every((l) => l.startsWith('- ')))
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.slice(2))}</li>
              ))}
            </ul>
          );
        if (lines[0].startsWith('> ')) return <CopyBlock key={i} text={lines.map((l) => l.replace(/^> ?/, '')).join(' ')} />;
        return <p key={i}>{inline(b)}</p>;
      })}
    </div>
  );
}
