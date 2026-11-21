/**
 * Reusable judge, laid out as one workbench: file tabs (Main.java, solution.py)
 * that switch language, a Run button in the header, the real code editor
 * (CodeMirror 6, src/components/Editor.jsx), a status bar, and a results panel.
 * Runs through the one run interface (src/lib/run), so Java compile errors are
 * marked on the lines and Python and Java judge against the same cases.
 *
 * Used by duels, the team contest, the daily problem, practice problems, labs
 * and the officer problem editor. Java is the default language (the club
 * teaches Java); a member's choice is remembered in this browser.
 *
 * Props:
 *   id         unique per page (labels and aria ids)
 *   cases      [{ stdin, stdout }] to judge against
 *   starter    problems.starter: a plain string (Python) or { java, python } JSON
 *   initial    same as starter (older callers)
 *   langs      allowed languages, default both; a single one shows one tab
 *   onChange   (code, lang) => void for the code on screen, now and after every edit or switch
 *   onResults  (results, passed, lang) => void after each Run tests
 *   runLabel   button text, default "Run tests"
 *   playground show the custom-input drawer, default true
 *
 * Remount it (key=) when the problem changes: the buffers start from the starter.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import Editor, { MOD } from './Editor.jsx';
import { judge, run as runOnce, warmUp, isReady } from '../lib/run/index.js';
import { parseStarter } from '../../shared/starter.js';
import './code-runner.css';

const FILE = { java: 'Main.java', python: 'solution.py' };
const LABEL = { java: 'Java', python: 'Python' };
const PHASE = { loading: 'Loading the compiler (first run only)', compiling: 'Compiling', running: 'Running' };

/** What a member sees in Java when a problem has no Java starter of its own. */
export const JAVA_SKELETON = `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // read the input with sc, then print the answer
    }
}
`;

// Per-viewer convenience only, shared with the editor lab; works without it.
const KEY = 'lab:lang';
const savedLang = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
const saveLang = (l) => {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* private mode */
  }
};

function Block({ label, text, bad }) {
  return (
    <div className="cr-blk">
      <p className="cr-blk-k">{label}</p>
      <pre className={bad ? 'bad' : ''}>{text || '(nothing)'}</pre>
    </div>
  );
}

export default function CodeRunner({
  id = 'code',
  cases = [],
  starter,
  initial = '',
  langs = ['java', 'python'],
  onChange,
  onResults,
  runLabel = 'Run tests',
  playground = true,
}) {
  const parsed = useMemo(() => parseStarter(starter ?? initial), [starter, initial]);
  const [lang, setLang] = useState(() => {
    const s = savedLang();
    return langs.includes(s) ? s : langs.includes('java') ? 'java' : langs[0];
  });
  const [buffers, setBuffers] = useState(() => ({ java: parsed.java || JAVA_SKELETON, python: parsed.python }));
  const code = buffers[lang];
  const [phase, setPhase] = useState(null);
  const [out, setOut] = useState(null); // { results, passed, compileError, diagnostics, lang } of the last Run tests
  const [err, setErr] = useState(null);
  const [stdin, setStdin] = useState('');
  const [play, setPlay] = useState(null);
  const busy = useRef(false);
  const latest = useRef({});
  latest.current = { onChange, onResults };

  // The parent hears about the code on screen from the start, and after every edit or switch.
  useEffect(() => {
    latest.current.onChange?.(code, lang);
  }, [code, lang]);
  // Start fetching the compiler or Python while the member reads the problem.
  useEffect(() => {
    warmUp(lang);
  }, [lang]);

  const edit = (v) => setBuffers((b) => ({ ...b, [lang]: v }));
  const pick = (l) => {
    if (l === lang) return;
    setLang(l);
    saveLang(l);
    setOut(null);
    setPlay(null);
    setErr(null);
  };

  const go = async () => {
    if (busy.current || !cases.length) return;
    busy.current = true;
    setErr(null);
    setOut(null);
    try {
      const res = await judge({ lang, source: code, cases, onPhase: setPhase });
      setOut({ results: res.results, passed: res.passed, compileError: res.compileError, diagnostics: res.diagnostics || [], lang });
      latest.current.onResults?.(res.results, res.passed, lang);
    } catch (e) {
      setErr(e.message);
    }
    setPhase(null);
    busy.current = false;
  };

  const goPlay = async () => {
    if (busy.current) return;
    busy.current = true;
    setErr(null);
    setPlay(null);
    try {
      const r = await runOnce({ lang, source: code, stdin, onPhase: setPhase });
      setPlay({ ...r, lang });
    } catch (e) {
      setErr(e.message);
    }
    setPhase(null);
    busy.current = false;
  };

  const shown = out?.lang === lang ? out : null;
  const results = shown?.results ?? [];
  const firstBad = results.findIndex((r) => !r.ok);
  const failing = firstBad >= 0 ? results[firstBad] : null;
  const nPass = results.filter((r) => r.ok).length;
  const running = Boolean(phase);

  // One line for the status bar, and its mood.
  let mood = 'idle';
  let status = isReady(lang) ? 'Ready' : `${LABEL[lang]} loads on the first run`;
  if (running) {
    mood = 'busy';
    status = `${PHASE[phase] ?? 'Working'}...`;
  } else if (err) {
    mood = 'bad';
    status = 'Something went wrong';
  } else if (shown?.compileError) {
    mood = 'bad';
    status = lang === 'java' ? 'Did not compile' : 'Syntax error';
  } else if (shown && results.length) {
    mood = failing ? 'bad' : 'ok';
    status = failing ? `${nPass} of ${results.length} tests passed` : `All ${results.length} tests passed`;
  }

  return (
    <section className={`cr cr-${mood}`} aria-label="Code workbench">
      <header className="cr-head">
        <div className="cr-tabs" role="tablist" aria-label="Language">
          {langs.map((l) => (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={l === lang}
              className={`cr-tab cr-${l}${l === lang ? ' on' : ''}`}
              onClick={() => pick(l)}
              disabled={running || langs.length === 1}
            >
              <i aria-hidden="true" />
              {FILE[l]}
            </button>
          ))}
        </div>
        <button type="button" className="cr-run" onClick={go} disabled={running || !cases.length}>
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor" /></svg>
          <span className="cr-run-long">{running ? 'Running' : runLabel}</span>
          <span className="cr-run-short">{running ? '...' : 'Run'}</span>
          <kbd>{MOD}+Enter</kbd>
        </button>
      </header>

      <Editor
        value={code}
        onChange={edit}
        lang={lang}
        onRun={go}
        diagnostics={shown?.diagnostics}
        label={`${LABEL[lang]} code`}
        minHeight="15rem"
        maxHeight="32rem"
      />

      <footer className="cr-bar" role="status" aria-live="polite">
        <span className="cr-state"><i aria-hidden="true" />{status}</span>
        <span className="cr-keys hide-xs">Tab indents &middot; Esc, Tab leaves</span>
      </footer>

      {err && <p className="cr-err" role="alert">{err}</p>}

      {shown?.compileError && (
        <div className="cr-res bad">
          <p className="cr-res-h">{lang === 'java' ? 'Did not compile' : 'Syntax error'}<span>the lines are marked in the editor</span></p>
          <Block label="Compiler" text={shown.compileError} bad />
        </div>
      )}

      {results.length > 0 && !shown?.compileError && (
        <div className={`cr-res ${failing ? 'bad' : 'ok'}`}>
          <p className="cr-res-h">
            {failing ? `${nPass} of ${results.length} tests passed` : `All ${results.length} tests passed`}
            {failing && <span>first miss: case {firstBad + 1}</span>}
          </p>
          <ul className="cr-cases">
            {results.map((r, i) => (
              <li key={i} className={r.ok ? 'ok' : 'bad'}>
                {r.ok ? 'pass' : 'fail'} <b>{i + 1}</b>
              </li>
            ))}
          </ul>
          {failing && !failing.timedOut && (
            <div className="cr-diff">
              <Block label="Expected" text={failing.expected} />
              <Block label="Got" text={failing.stdout} bad />
            </div>
          )}
          {failing?.stderr && <Block label={failing.timedOut ? 'Stopped' : 'Error'} text={failing.stderr} bad />}
        </div>
      )}

      {playground && (
        <details className="cr-play">
          <summary>Try your own input</summary>
          <div className="cr-play-b">
            <label className="cr-blk-k" htmlFor={`${id}-stdin`}>Input</label>
            <textarea id={`${id}-stdin`} rows={3} value={stdin} onChange={(e) => setStdin(e.target.value)} spellCheck={false} />
            <button type="button" className="cr-ghost" onClick={goPlay} disabled={running}>Run with this input</button>
            {play?.lang === lang && (
              <div aria-live="polite">
                {play.compileError ? (
                  <Block label="Compiler" text={play.compileError} bad />
                ) : (
                  <>
                    <Block label="Output" text={play.stdout} />
                    {play.stderr && <Block label={play.timedOut ? 'Stopped' : 'Error'} text={play.stderr} bad />}
                  </>
                )}
              </div>
            )}
          </div>
        </details>
      )}
    </section>
  );
}
