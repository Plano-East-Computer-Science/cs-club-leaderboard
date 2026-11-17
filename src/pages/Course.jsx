import { Fragment, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Spinner, ErrorNote } from '../components/bits.jsx';
import { runCases, warmUp, isReady } from '../lib/pyrunner.js';

const GOOD = '#2f8f5b';
const BAD = '#c42e2e';

/* ------------------------------- body text ------------------------------- */

function Inline({ text }) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**') && p.length > 4)
      return <strong key={i} style={{ color: 'var(--ink)' }}>{p.slice(2, -2)}</strong>;
    if (p.startsWith('`') && p.endsWith('`') && p.length > 2)
      return (
        <code key={i} className="mono rounded px-1 text-[0.85em]" style={{ background: 'var(--paper-2)' }}>
          {p.slice(1, -1)}
        </code>
      );
    return <Fragment key={i}>{p}</Fragment>;
  });
}

/** ``` fences, "## " headings, "- " bullets, **bold**, `code`. Never HTML. */
export function Body({ text = '' }) {
  const blocks = [];
  let code = null;
  let list = null;
  let para = [];
  const flushPara = () => {
    if (para.length) blocks.push({ k: 'p', t: para.join(' ') });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push({ k: 'ul', items: list });
    list = null;
  };
  for (const raw of text.split('\n')) {
    if (raw.trim().startsWith('```')) {
      if (code) {
        blocks.push({ k: 'code', t: code.join('\n') });
        code = null;
      } else {
        flushPara();
        flushList();
        code = [];
      }
      continue;
    }
    if (code) {
      code.push(raw);
      continue;
    }
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
    } else if (line.startsWith('## ')) {
      flushPara();
      flushList();
      blocks.push({ k: 'h', t: line.slice(3) });
    } else if (line.startsWith('- ')) {
      flushPara();
      (list ??= []).push(line.slice(2));
    } else {
      flushList();
      para.push(line);
    }
  }
  if (code) blocks.push({ k: 'code', t: code.join('\n') });
  flushPara();
  flushList();

  return (
    <div className="grid gap-4">
      {blocks.map((b, i) => {
        if (b.k === 'h')
          return <h3 key={i} className="display mt-2 text-lg font-bold">{b.t}</h3>;
        if (b.k === 'code')
          return (
            <pre key={i} className="mono overflow-x-auto rounded border p-3 text-[0.82rem] leading-relaxed" style={{ background: 'var(--paper-2)' }}>
              {b.t}
            </pre>
          );
        if (b.k === 'ul')
          return (
            <ul key={i} className="grid gap-1.5">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-3 text-[0.95rem]" style={{ color: 'var(--ink-soft)' }}>
                  <span className="mono shrink-0" style={{ color: 'var(--flag)' }} aria-hidden="true">▸</span>
                  <span><Inline text={it} /></span>
                </li>
              ))}
            </ul>
          );
        return (
          <p key={i} className="text-[0.95rem] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            <Inline text={b.t} />
          </p>
        );
      })}
    </div>
  );
}

/* --------------------------------- page --------------------------------- */

export default function Course() {
  const { slug } = useParams();
  const [course, setCourse] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({});
  const [signedIn, setSignedIn] = useState(false);
  const [cur, setCur] = useState(0);
  const [codes, setCodes] = useState({});
  const saveTimer = useRef(null);

  const load = () => {
    setError(null);
    setCourse(null);
    api
      .get(`/learn/${encodeURIComponent(slug)}`)
      .then((d) => {
        setCourse(d);
        setProgress(d.progress || {});
        setSignedIn(Boolean(d.signedIn));
        const first = d.steps.findIndex((s) => !d.progress?.[s.id]?.passed);
        setCur(first === -1 ? 0 : first);
        if (d.steps.some((s) => s.kind === 'code')) warmUp();
      })
      .catch((e) => setError(e.message));
  };
  useEffect(load, [slug]);
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  if (error) return <ErrorNote onRetry={load}>{error}</ErrorNote>;
  if (!course) return <Spinner label="Loading course" />;

  const steps = course.steps;
  const step = steps[cur];
  const passedCount = steps.filter((s) => progress[s.id]?.passed).length;
  const allDone = passedCount === steps.length;

  const markPassed = (id) => setProgress((p) => ({ ...p, [id]: { ...p[id], passed: true } }));

  /** POST a check. Returns the body, or null when signed out (401). */
  const check = async (body) => {
    try {
      return await api.post(`/learn/${encodeURIComponent(slug)}/check`, body);
    } catch (e) {
      if (e.status === 401) {
        setSignedIn(false);
        return null;
      }
      throw e;
    }
  };

  const onCode = (id, code) => {
    setCodes((c) => ({ ...c, [id]: code }));
    if (!signedIn) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api.put(`/learn/${encodeURIComponent(slug)}/draft`, { step: id, code }).catch(() => {});
    }, 800);
  };

  return (
    <div>
      <header className="mb-6">
        <Link to="/learn" className="eyebrow hover:underline">← All courses</Link>
        <h1 className="display mt-2 text-[clamp(1.8rem,5vw,2.8rem)] leading-[1] font-extrabold">
          {course.title}
        </h1>
        <p className="mono mt-2 text-xs" style={{ color: 'var(--ink-faint)' }}>
          {course.level} · {course.minutes} min · {passedCount} / {steps.length} done
        </p>
      </header>

      {!signedIn && (
        <p className="mb-5 border-l-2 pl-3 text-sm" style={{ borderColor: 'var(--flag)', color: 'var(--ink-soft)' }}>
          <Link to="/signin" className="underline" style={{ color: 'var(--flag)' }}>
            Sign in to save progress
          </Link>
          . You can still read and run code without it, but answers can't be checked or saved.
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-[14rem_1fr]">
        <nav aria-label="Steps">
          <ol className="flex gap-1 overflow-x-auto pb-2 md:flex-col md:overflow-visible md:pb-0">
            {steps.map((s, i) => {
              const done = progress[s.id]?.passed;
              const on = i === cur;
              return (
                <li key={s.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setCur(i)}
                    aria-current={on ? 'step' : undefined}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded border px-2.5 py-1.5 text-left text-sm"
                    style={{
                      borderColor: on ? 'var(--flag)' : 'transparent',
                      background: on ? 'var(--flag-soft)' : 'transparent',
                      color: on ? 'var(--ink)' : 'var(--ink-soft)',
                    }}
                  >
                    <span
                      className="mono grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[0.65rem] font-bold"
                      style={{
                        borderColor: done ? 'var(--flag)' : 'var(--rule)',
                        background: done ? 'var(--flag)' : 'transparent',
                        color: done ? 'light-dark(#fff, #0d1017)' : 'var(--ink-faint)',
                      }}
                    >
                      {done ? '✓' : i + 1}
                    </span>
                    <span className="hidden md:inline">{s.title}</span>
                    <span className="sr-only md:hidden">
                      {s.title}
                      {done ? ' (done)' : ''}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <main className="min-w-0">
          <article key={step.id} className="card p-5">
            <p className="eyebrow">Step {cur + 1} of {steps.length} · {step.kind}</p>
            <h2 className="display mt-1 mb-4 text-2xl font-bold">{step.title}</h2>
            <Body text={step.body} />
            <div className="mt-6">
              {step.kind === 'read' && (
                <ReadStep step={step} done={progress[step.id]?.passed} check={check} onPassed={markPassed} />
              )}
              {step.kind === 'mcq' && (
                <McqStep step={step} done={progress[step.id]?.passed} check={check} onPassed={markPassed} />
              )}
              {step.kind === 'flag' && (
                <FlagStep step={step} done={progress[step.id]?.passed} check={check} onPassed={markPassed} />
              )}
              {step.kind === 'code' && (
                <CodeStep
                  step={step}
                  done={progress[step.id]?.passed}
                  initial={codes[step.id] ?? progress[step.id]?.code ?? step.starter ?? ''}
                  onCode={onCode}
                  check={check}
                  onPassed={markPassed}
                />
              )}
            </div>
          </article>

          <div className="mt-4 flex justify-between gap-3">
            <button className="btn btn-ghost" disabled={cur === 0} onClick={() => setCur(cur - 1)}>
              ← Previous
            </button>
            <button className="btn btn-ghost" disabled={cur === steps.length - 1} onClick={() => setCur(cur + 1)}>
              Next →
            </button>
          </div>

          {allDone && (
            <section className="mt-6 border-t pt-4" aria-live="polite">
              <p className="display text-lg font-bold">Course complete.</p>
              <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
                Every step is passed. Put it to work on a{' '}
                <Link to="/projects" className="underline" style={{ color: 'var(--flag)' }}>project</Link>, or{' '}
                <Link to="/learn" className="underline" style={{ color: 'var(--flag)' }}>pick another course</Link>.
              </p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

/* -------------------------------- step kinds -------------------------------- */

function Verdict({ ok, children }) {
  return (
    <p role="status" className="mt-3 text-sm font-semibold" style={{ color: ok ? GOOD : BAD }}>
      {children}
    </p>
  );
}

function Passed({ done }) {
  return done ? (
    <p className="mono mb-3 text-xs font-semibold" style={{ color: GOOD }}>✓ Passed</p>
  ) : null;
}

function ReadStep({ step, done, check, onPassed }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const go = async () => {
    setBusy(true);
    setErr(null);
    try {
      await check({ step: step.id });
      onPassed(step.id); // marked locally even when signed out
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  };
  return (
    <div>
      <Passed done={done} />
      {!done && (
        <button className="btn btn-primary" onClick={go} disabled={busy}>
          Mark as read
        </button>
      )}
      {err && <Verdict ok={false}>{err}</Verdict>}
    </div>
  );
}

function McqStep({ step, done, check, onPassed }) {
  const [pick, setPick] = useState(null);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    if (pick === null) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await check({ step: step.id, answer: pick });
      if (!r) setErr('Sign in to check your answer.');
      else {
        setRes(r);
        if (r.correct) onPassed(step.id);
      }
    } catch (e2) {
      setErr(e2.message);
    }
    setBusy(false);
  };
  return (
    <form onSubmit={submit}>
      <Passed done={done} />
      <fieldset>
        <legend className="sr-only">{step.title}</legend>
        <div className="grid gap-2">
          {(step.options || []).map((o, i) => (
            <label
              key={i}
              className="flex cursor-pointer items-start gap-3 rounded border px-3 py-2 text-[0.92rem]"
              style={{ borderColor: pick === i ? 'var(--flag)' : 'var(--rule)' }}
            >
              <input
                type="radio"
                name={`mcq-${step.id}`}
                className="mt-1"
                checked={pick === i}
                onChange={() => {
                  setPick(i);
                  setRes(null);
                }}
              />
              <span><Inline text={o} /></span>
            </label>
          ))}
        </div>
      </fieldset>
      <button className="btn btn-primary mt-4" disabled={busy || pick === null}>
        Check
      </button>
      {res && (
        <>
          <Verdict ok={res.correct}>{res.correct ? 'Correct.' : 'Not quite. Try another option.'}</Verdict>
          {res.explain && (
            <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
              <Inline text={res.explain} />
            </p>
          )}
        </>
      )}
      {err && <Verdict ok={false}>{err}</Verdict>}
    </form>
  );
}

function FlagStep({ step, done, check, onPassed }) {
  const [val, setVal] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    if (!val.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await check({ step: step.id, answer: val.trim() });
      if (!r) setErr('Sign in to check your answer.');
      else {
        setRes(r);
        if (r.correct) onPassed(step.id);
      }
    } catch (e2) {
      setErr(e2.message);
    }
    setBusy(false);
  };
  return (
    <form onSubmit={submit}>
      <Passed done={done} />
      <label className="eyebrow mb-1 block" htmlFor={`flag-${step.id}`}>Answer</label>
      <div className="flex flex-wrap gap-2">
        <input
          id={`flag-${step.id}`}
          className="field mono max-w-sm"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <button className="btn btn-primary" disabled={busy || !val.trim()}>Check</button>
      </div>
      {res && <Verdict ok={res.correct}>{res.correct ? 'Correct.' : 'Not it. Check and try again.'}</Verdict>}
      {res?.explain && (
        <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}><Inline text={res.explain} /></p>
      )}
      {err && <Verdict ok={false}>{err}</Verdict>}
    </form>
  );
}

function CodeStep({ step, done, initial, onCode, check, onPassed }) {
  const [code, setCode] = useState(initial);
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState(null);
  const escaped = useRef(false); // Esc then Tab leaves the editor (keyboard trap otherwise)

  const change = (v) => {
    setCode(v);
    onCode(step.id, v);
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
      const res = await runCases(code, step.cases || []);
      setResults(res);
      const passed = res.length > 0 && res.every((r) => r.ok);
      const r = await check({ step: step.id, passed, code });
      if (passed) onPassed(step.id); // local pass even when signed out (r === null)
      void r;
    } catch (e) {
      setErr(e.message);
    }
    setRunning(false);
  };

  const failing = results?.find((r) => !r.ok);
  const shown = failing || results?.[0];
  const nPass = results?.filter((r) => r.ok).length ?? 0;

  return (
    <div>
      <Passed done={done} />
      <label className="eyebrow mb-1 block" htmlFor={`code-${step.id}`}>Your code (Python)</label>
      <textarea
        id={`code-${step.id}`}
        className="mono w-full rounded border p-3 text-[0.85rem] leading-relaxed"
        style={{ background: 'var(--card)', color: 'var(--ink)', minHeight: '14rem', tabSize: 4 }}
        value={code}
        onChange={(e) => change(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => (escaped.current = false)}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        rows={Math.min(24, Math.max(10, code.split('\n').length + 2))}
        aria-describedby={`code-hint-${step.id}`}
      />
      <p id={`code-hint-${step.id}`} className="mono mt-1 text-[0.68rem]" style={{ color: 'var(--ink-faint)' }}>
        Tab indents. Press Esc, then Tab, to move on.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" onClick={run} disabled={running}>
          {running ? 'Running…' : 'Run tests'}
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => {
            change(step.starter ?? '');
            setResults(null);
          }}
          disabled={running}
        >
          Reset to starter
        </button>
        {running && !isReady() && (
          <span className="mono text-xs" style={{ color: 'var(--ink-faint)' }} role="status">
            Loading Python (first run only)...
          </span>
        )}
      </div>

      {err && <Verdict ok={false}>{err}</Verdict>}

      {results && (
        <div className="mt-4" aria-live="polite">
          <Verdict ok={!failing}>
            {failing ? `${nPass} / ${results.length} tests passed` : `All ${results.length} tests passed.`}
          </Verdict>
          <ul className="mono mt-2 flex flex-wrap gap-1.5 text-[0.7rem]">
            {results.map((r, i) => (
              <li
                key={i}
                className="rounded border px-1.5 py-0.5"
                style={{ color: r.ok ? GOOD : BAD, borderColor: 'currentColor' }}
              >
                {r.ok ? '✓' : '✗'} case {i + 1}
              </li>
            ))}
          </ul>

          {failing && !failing.timedOut && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Output label="Expected" text={failing.expected} />
              <Output label="Got" text={failing.stdout} />
            </div>
          )}
          {shown?.stderr && <Output label={shown.timedOut ? 'Stopped' : 'Error'} text={shown.stderr} bad />}
          {!failing && shown?.stdout && <Output label="Your output" text={shown.stdout} />}
        </div>
      )}
    </div>
  );
}

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
