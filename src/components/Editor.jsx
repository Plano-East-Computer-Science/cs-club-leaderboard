/**
 * Code editor (CodeMirror 6): line numbers, Java and Python highlighting,
 * bracket matching and auto-close, indent on Enter, completion of keywords and
 * words in the file, inline error markers. CodeMirror itself (src/lib/cm.js)
 * loads on first use, so pages without an editor do not pay for it. If it
 * cannot load, a plain text box takes its place.
 *
 * Props:
 *   value, onChange(code)   controlled text
 *   lang                    'java' | 'python'
 *   onRun()                 Ctrl+Enter / Cmd+Enter
 *   diagnostics             [{ line, col?, message, severity? }] from run() / judge()
 *   label                   accessible name, default "Code"
 *   readOnly
 *   minHeight, maxHeight    CSS lengths; the editor grows with the code between them
 *
 * Keyboard: Tab indents, Shift+Tab outdents, Esc then Tab moves on.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { useCodeKeys } from '../lib/codeKeys.js';

let cm = null;
/** Starts downloading the editor early (for example on hover of a "Solve" link). */
export const preloadEditor = () => (cm ??= import('../lib/cm.js'));

const NONE = [];
export const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? 'Cmd' : 'Ctrl';

export default function Editor({
  value = '',
  onChange,
  lang = 'java',
  onRun,
  diagnostics = NONE,
  label = 'Code',
  readOnly = false,
  minHeight = '16rem',
  maxHeight = '36rem',
}) {
  const host = useRef(null);
  const api = useRef(null);
  const latest = useRef({});
  latest.current = { onChange, onRun, value, lang, diagnostics };
  const [state, setState] = useState('loading'); // loading | ready | failed
  const hintId = useId();

  useEffect(() => {
    let gone = false;
    preloadEditor()
      .then(({ createEditor }) => {
        if (gone) return;
        const l = latest.current;
        api.current = createEditor({
          parent: host.current,
          doc: l.value,
          lang: l.lang,
          label,
          describedBy: hintId,
          readOnly,
          onChange: (v) => latest.current.onChange?.(v),
          onRun: () => latest.current.onRun?.(),
        });
        api.current.setDiagnostics(l.diagnostics);
        setState('ready');
      })
      .catch(() => !gone && setState('failed'));
    return () => {
      gone = true;
      api.current?.destroy();
      api.current = null;
    };
    // label, readOnly and hintId are fixed for the editor's life
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => api.current?.setDoc(value), [value]);
  useEffect(() => api.current?.setLang(lang), [lang]);
  useEffect(() => api.current?.setDiagnostics(diagnostics), [diagnostics]);

  const keys = useCodeKeys(value, (v) => onChange?.(v), onRun);

  return (
    <div className="cedit" style={{ '--ed-min': minHeight, '--ed-max': maxHeight }}>
      {state === 'failed' ? (
        <textarea
          className="cedit-fallback"
          aria-label={label}
          aria-describedby={hintId}
          value={value}
          readOnly={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          {...keys}
        />
      ) : (
        <>
          <div ref={host} className="cedit-host" />
          {state === 'loading' && (
            <pre className="cedit-loading" aria-busy="true" aria-label={`${label} (loading the editor)`}>{value}</pre>
          )}
        </>
      )}
      <p id={hintId} className="cedit-hint">
        Tab indents. Esc then Tab moves on. {onRun ? `${MOD}+Enter runs.` : ''}
      </p>
    </div>
  );
}
