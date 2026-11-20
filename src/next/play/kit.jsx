/**
 * Pieces every Play game uses: Java code with light highlighting, hearts,
 * the result panel with its copyable share text, and a key handler.
 */
import { Fragment, useEffect, useRef } from 'react';
import { Copy, Heart } from '@phosphor-icons/react';
import { Button, useToast, cx } from '../../ui/index.js';

/* ----------------------------------- code ----------------------------------- */

const KW = 'int|double|char|boolean|long|short|byte|float|void|static|public|private|protected|class|extends|new|return|if|else|for|while|do|break|continue|true|false|null|this|super|final|import';
const TOKEN = new RegExp(`(//.*$)|("(?:\\\\.|[^"\\\\])*")|('(?:\\\\.|[^'\\\\])')|\\b(${KW})\\b|\\b(\\d+(?:\\.\\d+)?)\\b|\\b([A-Z]\\w*)\\b`, 'g');
const KIND = ['', 'c', 's', 's', 'k', 'n', 't'];

/** One line of Java as spans. */
export function Hl({ line }) {
  const out = [];
  let last = 0;
  for (const m of line.matchAll(TOKEN)) {
    if (m.index > last) out.push(line.slice(last, m.index));
    const kind = KIND[m.slice(1).findIndex((g) => g !== undefined) + 1];
    out.push(<span key={m.index} className={`pl-hl-${kind}`}>{m[0]}</span>);
    last = m.index + m[0].length;
  }
  out.push(line.slice(last));
  return <>{out.map((x, i) => <Fragment key={i}>{x}</Fragment>)}</>;
}

/** A read-only block of code. */
export function Code({ code, className }) {
  return (
    <pre className={cx('pl-code', className)}>
      <code>
        {code.split('\n').map((l, i) => (
          <span key={i} className="pl-code__l">
            <Hl line={l} />
            {'\n'}
          </span>
        ))}
      </code>
    </pre>
  );
}

/* ---------------------------------- hearts ---------------------------------- */

export function Hearts({ left, of = 3 }) {
  return (
    <span className="pl-hearts" role="img" aria-label={`${left} of ${of} lives left`}>
      {Array.from({ length: of }, (_, i) => (
        <Heart key={i} size={20} weight={i < left ? 'fill' : 'regular'} className={i < left ? 'pl-heart' : 'pl-heart pl-heart--gone'} aria-hidden="true" />
      ))}
    </span>
  );
}

/* --------------------------------- results --------------------------------- */

const CELL = { '🟩': 'hit', '🟨': 'near', '⬛': 'miss', '🟥': 'bad', '🟦': 'blue', '🟪': 'purple' };

/** The share grid drawn as coloured squares (emoji stay in the copied text only). */
export function Grid({ text, label = 'Your result' }) {
  if (!text) return null;
  return (
    <div className="pl-grid" role="img" aria-label={label}>
      {text.split('\n').map((row, r) => (
        <div key={r} className="pl-grid__r">
          {Array.from(row).filter((c) => CELL[c]).map((c, i) => (
            <span key={i} className={`pl-grid__c pl-c-${CELL[c]}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    document.body.append(t);
    t.select();
    const ok = document.execCommand('copy');
    t.remove();
    return ok;
  }
}

export const shareLink = () => `${location.host}/play`;

/**
 * The end of a round: a big headline, the grid, Copy result, then whatever
 * the game wants to explain. `footer` comes from the game page (next game,
 * practice round).
 */
export function Result({ headline, sub, grid, share, footer, children }) {
  const toast = useToast();
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);
  const copy = async () => toast((await copyText(share)) ? 'Result copied. Paste it anywhere.' : 'Copy did not work in this browser.', { tone: 'ok' });
  return (
    <section className="pl-result" aria-labelledby="pl-result-h">
      <h2 id="pl-result-h" className="pl-result__h" tabIndex={-1} ref={ref}>{headline}</h2>
      {sub && <p className="pl-result__s">{sub}</p>}
      <Grid text={grid} />
      <div className="pl-result__a">
        {share && <Button variant="primary" icon={Copy} onClick={copy}>Copy result</Button>}
        {footer}
      </div>
      {children}
    </section>
  );
}

/* ----------------------------------- keys ----------------------------------- */

/** Window key handler that stays out of the way of dialogs, fields and shortcuts. */
export function useKeys(handler, active = true) {
  const h = useRef(handler);
  h.current = handler;
  useEffect(() => {
    if (!active) return;
    const f = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      if (document.querySelector('.ui-dialog, .ui-overlay')) return;
      const t = e.target;
      if (t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)) return;
      if (e.key === 'Enter' && t?.closest?.('button, a')) return; // the focused control handles Enter itself
      h.current(e);
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [active]);
}

export const fmtTime = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
