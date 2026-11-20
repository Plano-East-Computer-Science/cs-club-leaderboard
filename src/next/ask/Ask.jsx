/**
 * Ask: the tutor panel. A button in the corner opens a side panel where a
 * signed-in member can ask about what they are looking at. Hidden entirely
 * when the site has no tutor key (GET /api/ask/status) or nobody is signed in.
 *
 * Pages feed it context with `useAskContext({ where, title, lang, code, error })`
 * (a lesson exercise, a problem page), so "why does this fail?" just works.
 * The conversation lives in memory only: nothing is stored.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { ChatCircleText, X, PaperPlaneRight } from '@phosphor-icons/react';
import { api } from '../../lib/api.js';
import { useSession } from '../../ui/index.js';
import './ask.css';

/* ------------------------- page context, a tiny store ------------------------- */
let ctx = null;
const subs = new Set();
const setCtx = (v) => {
  ctx = v;
  subs.forEach((f) => f());
};
const useCtx = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => ctx);

/** Tell the tutor what the student is looking at, while this component is mounted. */
export function useAskContext(value) {
  const key = JSON.stringify(value ?? null);
  useEffect(() => {
    setCtx(value ?? null);
    return () => setCtx(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

let enabledP = null;
const askEnabled = () => (enabledP ??= api.get('/ask/status').then((r) => Boolean(r.enabled)).catch(() => false));

/** Splits an answer into text and fenced code blocks. Text only, never HTML. */
function Answer({ text }) {
  const parts = String(text).split(/```[a-z]*\n?/);
  return (
    <div className="ak-ans">
      {parts.map((p, i) =>
        i % 2 ? (
          <pre key={i}>
            <code>{p.replace(/\n$/, '')}</code>
          </pre>
        ) : (
          p
            .split(/\n{2,}/)
            .filter((x) => x.trim())
            .map((para, j) => <p key={`${i}-${j}`}>{para}</p>)
        )
      )}
    </div>
  );
}

const STARTERS = ['Explain my error', 'Give me a hint, not the answer', 'What should I learn next?'];

export default function AskDock() {
  const { user } = useSession();
  const { pathname } = useLocation();
  const page = useCtx();
  const [on, setOn] = useState(false);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const box = useRef(null);
  const input = useRef(null);

  useEffect(() => {
    if (user) askEnabled().then(setOn);
  }, [user]);
  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [msgs, busy]);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && setOpen(false);
    if (open) window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open]);

  // Never during a live room: duels and contests are the student's own work.
  if (!on || !user || /^\/(room|host|speaker)\b/.test(pathname)) return null;

  const send = async (q) => {
    const question = (q ?? text).trim();
    if (!question || busy) return;
    const next = [...msgs, { role: 'user', content: question }];
    setMsgs(next);
    setText('');
    setBusy(true);
    setErr('');
    try {
      const r = await api.post('/ask', {
        messages: next,
        context: { where: page?.where || document.title, title: page?.title, lang: page?.lang, code: page?.code, error: page?.error },
      });
      setMsgs([...next, { role: 'assistant', content: r.answer }]);
    } catch (e) {
      setErr(e.message);
      setMsgs(msgs);
      setText(question);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {!open && (
        <button type="button" className="ak-fab" onClick={() => setOpen(true)} aria-label="Ask the tutor">
          <ChatCircleText size={22} weight="fill" aria-hidden="true" />
          <span>Ask</span>
        </button>
      )}
      {open && (
        <aside className="ak-panel" role="dialog" aria-label="Tutor">
          <header className="ak-h">
            <div>
              <h2>Ask the tutor</h2>
              <p>{page?.title ? `About: ${page.title}` : 'Hints, errors, what to learn next.'}</p>
            </div>
            <button type="button" className="ak-x" onClick={() => setOpen(false)} aria-label="Close the tutor">
              <X size={20} aria-hidden="true" />
            </button>
          </header>
          <div className="ak-log" ref={box} aria-live="polite">
            {!msgs.length && (
              <div className="ak-empty">
                <p>It gives hints before answers, so you still learn it. It can see the code on this page.</p>
                <div className="ak-starters">
                  {STARTERS.map((s) => (
                    <button key={s} type="button" onClick={() => send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) =>
              m.role === 'user' ? (
                <p key={i} className="ak-q">
                  {m.content}
                </p>
              ) : (
                <Answer key={i} text={m.content} />
              )
            )}
            {busy && <p className="ak-think">Thinking</p>}
            {err && (
              <p className="ak-err" role="alert">
                {err}
              </p>
            )}
          </div>
          <form
            className="ak-form"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <label htmlFor="ak-in" className="ak-sr">
              Your question
            </label>
            <textarea
              id="ak-in"
              ref={input}
              rows={2}
              value={text}
              maxLength={2000}
              placeholder="Ask about this page or your code"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button type="submit" className="ak-send" disabled={busy || !text.trim()} aria-label="Send">
              <PaperPlaneRight size={20} weight="fill" aria-hidden="true" />
            </button>
          </form>
        </aside>
      )}
    </>
  );
}
