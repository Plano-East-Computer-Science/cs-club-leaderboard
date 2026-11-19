/**
 * /lab/editor: a try-it page for the new editor and the run interface
 * (V3-C). Only in dev builds or with ?editor=1, until problem pages move over.
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Editor, { MOD } from '../components/Editor.jsx';
import { run, warmUp, LANGS } from '../lib/run/index.js';

const STARTERS = {
  java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        long total = 0;
        for (int i = 0; i < n; i++) {
            total += sc.nextInt();
        }
        System.out.println("Sum: " + total);
        System.out.printf("Average: %.2f%n", (double) total / n);
    }
}
`,
  python: `n = int(input())
nums = list(map(int, input().split()))
print("Sum:", sum(nums))
print(f"Average: {sum(nums) / n:.2f}")
`,
};
const STDIN = '4\n3 9 12 7\n';

const PHASE = { loading: 'Loading the compiler (first run only)', compiling: 'Compiling', running: 'Running' };

// Per-viewer convenience only; the page works without it.
const saved = (k, d) => {
  try {
    return localStorage.getItem(`lab:${k}`) ?? d;
  } catch {
    return d;
  }
};
const save = (k, v) => {
  try {
    localStorage.setItem(`lab:${k}`, v);
  } catch {
    /* private mode */
  }
};

export default function EditorLab() {
  const { search } = useLocation();
  const allowed = import.meta.env.DEV || new URLSearchParams(search).has('editor');
  const [lang, setLang] = useState(() => (saved('lang', 'java') === 'python' ? 'python' : 'java'));
  const [code, setCode] = useState(() => ({ java: saved('java', STARTERS.java), python: saved('python', STARTERS.python) }));
  const [stdin, setStdin] = useState(STDIN);
  const [phase, setPhase] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const busy = useRef(false);

  useEffect(() => {
    if (allowed) warmUp(lang);
  }, [lang, allowed]);

  if (!allowed) {
    return (
      <div className="state-note">
        <p className="display" style={{ fontSize: 40, color: 'var(--text)' }}>Nothing here</p>
      </div>
    );
  }

  const source = code[lang];
  const setSource = (v) => {
    setCode((c) => ({ ...c, [lang]: v }));
    save(lang, v);
  };
  const pick = (l) => {
    setLang(l);
    save('lang', l);
    setResult(null);
    setError(null);
  };

  const go = async () => {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    const t0 = performance.now();
    try {
      const r = await run({ lang, source, stdin, timeoutMs: 5000, onPhase: setPhase });
      setResult({ ...r, lang, wallMs: Math.round(performance.now() - t0) });
    } catch (e) {
      setError(e.message);
      setResult(null);
    }
    setPhase(null);
    busy.current = false;
  };

  const status = phase
    ? `${PHASE[phase]}...`
    : result
      ? result.compileError
        ? `${result.lang === 'java' ? 'Did not compile' : 'Syntax error'}. See the marked lines.`
        : result.timedOut
          ? 'Stopped after 5 seconds.'
          : `Done in ${(result.wallMs / 1000).toFixed(1)} s. Your program ran for ${result.timeMs} ms.`
      : '';
  const shown = result?.lang === lang ? result : null;

  return (
    <div className="hub lab">
      <header className="lab-head">
        <p className="eyebrow">lab</p>
        <h1>Editor</h1>
        <p>Write Java or Python, give it input, run it. Everything runs in your browser, nothing is sent anywhere.</p>
      </header>

      <div className="lab-bar">
        <div className="lab-langs" role="radiogroup" aria-label="Language">
          {LANGS.map((l) => (
            <label key={l.id}>
              <input type="radio" name="lab-lang" value={l.id} checked={lang === l.id} onChange={() => pick(l.id)} />
              <span>{l.label}</span>
            </label>
          ))}
        </div>
        <button type="button" className="btn pri lab-run" onClick={go} disabled={!!phase}>
          Run <kbd>{MOD}+Enter</kbd>
        </button>
        <p className={`lab-status${phase ? ' busy' : ''}`} role="status" aria-live="polite">{status}</p>
      </div>

      <div className="lab-grid">
        <Editor
          value={source}
          onChange={setSource}
          lang={lang}
          onRun={go}
          diagnostics={shown?.diagnostics}
          label={`${lang === 'java' ? 'Java' : 'Python'} code`}
          minHeight="26rem"
          maxHeight="40rem"
        />
        <div className="lab-side">
          <section className="lab-panel">
            <div className="lab-panel-h"><label htmlFor="lab-stdin">Input</label></div>
            <textarea
              id="lab-stdin"
              className="lab-stdin"
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
          </section>
          <section className="lab-panel" aria-label="Output">
            <div className="lab-panel-h">
              <span>Output</span>
              {shown && !shown.compileError && (
                <span className={`lab-pill ${shown.exitCode === 0 ? 'ok' : 'bad'}`}>exit {shown.exitCode}</span>
              )}
            </div>
            <pre className="lab-out" aria-live="polite">
              {error && <span className="err">{error}</span>}
              {!error && !shown && <span className="quiet">Run your code to see what it prints.</span>}
              {shown?.compileError && <span className="err">{shown.compileError}</span>}
              {shown && !shown.compileError && (
                <>
                  {shown.stdout}
                  {shown.stderr && <span className="err">{shown.stdout && !shown.stdout.endsWith('\n') ? '\n' : ''}{shown.stderr}</span>}
                  {!shown.stdout && !shown.stderr && <span className="quiet">(no output)</span>}
                </>
              )}
            </pre>
          </section>
        </div>
      </div>
    </div>
  );
}
