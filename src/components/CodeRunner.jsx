/**
 * Reusable judge: a code box that runs Python in the browser (Pyodide, via
 * src/lib/pyrunner.js) against stdin/stdout cases, shows pass/fail per case
 * with expected vs got, and has a free stdin playground.
 *
 * Used by the officer problem editor; duels, the daily problem and labs
 * should use it too. Modelled on CodeStep in src/pages/Course.jsx, which is
 * left as it was.
 *
 * Props:
 *   id         unique per page (labels and aria ids)
 *   cases      [{ stdin, stdout }] to judge against
 *   value      controlled code (omit to let the component own it, seeded by `initial`)
 *   initial    starting code when uncontrolled
 *   onChange   (code) => void
 *   onResults  (results, passed) => void after each Run tests
 *   runLabel   button text, default "Run tests"
 *   playground show the stdin box, default true
 */
import { useRef, useState } from 'react';
import { runCases, isReady } from '../lib/pyrunner.js';

const GOOD = '#2f8f5b';
const BAD = '#c42e2e';

function Output({ label, text, bad }) {
  return (
    <div className="mt-2 min-w-0">
      <p className="eyebrow mb-1">{label}</p>
      <pre
        className="mono max-h-56 overflow-auto rounded border p-2.5 text-[0.8rem] whitespace-pre-wrap"
        style={{ background: 'var(--paper-2)', color: bad ? BAD : 'var(--ink)' }}
      >
        {text || '(nothing)'}
      </pre>
    </div>
  );
}

export default function CodeRunner({
  id = 'code',
  cases = [],
  value,
  initial = '',
  onChange,
  onResults,
  runLabel = 'Run tests',
  playground = true,
}) {
  const [own, setOwn] = useState(initial);
  const code = value ?? own;
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState(null);
  const [stdin, setStdin] = useState('');
  const [play, setPlay] = useState(null);
  const escaped = useRef(false); // Esc then Tab leaves the editor (keyboard trap otherwise)

  const change = (v) => {
    setOwn(v);
    onChange?.(v);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      escaped.current = true;
      return;
    }
    if (e.key === 'Tab' && !e.shiftKey && !escaped.current) {
      e.preventDefault();
      const t = e.target;
      const { selectionStart: a, selectionEnd: b } = t;
      change(code.slice(0, a) + '    ' + code.slice(b));
      requestAnimationFrame(() => t.setSelectionRange(a + 4, a + 4));
    }
    if (e.key !== 'Tab') escaped.current = false;
  };

  const run = async () => {
    setRunning(true);
    setErr(null);
    setResults(null);
    try {
      const res = await runCases(code, cases);
      setResults(res);
      onResults?.(res, res.length > 0 && res.every((r) => r.ok));
    } catch (e) {
      setErr(e.message);
    }
    setRunning(false);
  };

  const runPlay = async () => {
    setRunning(true);
    setErr(null);
    setPlay(null);
    try {
      const [r] = await runCases(code, [{ stdin, stdout: '' }]);
      setPlay(r);
    } catch (e) {
      setErr(e.message);
    }
    setRunning(false);
  };

  const failing = results?.find((r) => !r.ok);
  const nPass = results?.filter((r) => r.ok).length ?? 0;

  return (
    <div>
      <label className="eyebrow mb-1 block" htmlFor={`${id}-code`}>Code (Python)</label>
      <textarea
        id={`${id}-code`}
        className="mono w-full rounded border p-3 text-[0.85rem] leading-relaxed"
        style={{ background: 'var(--card)', color: 'var(--ink)', minHeight: '12rem', tabSize: 4 }}
        value={code}
        onChange={(e) => change(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => (escaped.current = false)}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        rows={Math.min(24, Math.max(10, code.split('\n').length + 2))}
        aria-describedby={`${id}-hint`}
      />
      <p id={`${id}-hint`} className="mono mt-1 text-xs" style={{ color: 'var(--ink-faint)' }}>
        Tab indents. Press Esc, then Tab, to move on.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className="btn pri" onClick={run} disabled={running || !cases.length}>
          {running ? 'Running...' : runLabel}
        </button>
        {running && !isReady() && (
          <span className="mono text-xs" style={{ color: 'var(--ink-faint)' }} role="status">
            Loading Python (first run only)...
          </span>
        )}
      </div>

      {err && <p className="mono mt-2 text-xs" style={{ color: BAD }}>{err}</p>}

      {results && (
        <div className="mt-4" aria-live="polite">
          <p className="mono text-sm" style={{ color: failing ? BAD : GOOD }}>
            {failing ? `${nPass} / ${results.length} tests passed` : `All ${results.length} tests passed.`}
          </p>
          <ul className="mono mt-2 flex flex-wrap gap-1.5 text-xs">
            {results.map((r, i) => (
              <li key={i} className="rounded border px-1.5 py-0.5" style={{ color: r.ok ? GOOD : BAD, borderColor: 'currentColor' }}>
                {r.ok ? 'pass' : 'fail'} case {i + 1}
              </li>
            ))}
          </ul>
          {failing && !failing.timedOut && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Output label="Expected" text={failing.expected} />
              <Output label="Got" text={failing.stdout} />
            </div>
          )}
          {failing?.stderr && <Output label={failing.timedOut ? 'Stopped' : 'Error'} text={failing.stderr} bad />}
        </div>
      )}

      {playground && (
        <div className="mt-5">
          <label className="eyebrow mb-1 block" htmlFor={`${id}-stdin`}>Try your own input</label>
          <textarea
            id={`${id}-stdin`}
            className="field mono"
            rows={3}
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            spellCheck={false}
          />
          <button type="button" className="btn mt-2" onClick={runPlay} disabled={running}>Run with this input</button>
          {play && (
            <div aria-live="polite">
              <Output label="Output" text={play.stdout} />
              {play.stderr && <Output label={play.timedOut ? 'Stopped' : 'Error'} text={play.stderr} bad />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
