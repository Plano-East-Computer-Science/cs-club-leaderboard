/**
 * One component per step kind. Each gets the step `s`, its saved state `st`
 * and `set(patch)` (kept by the player, so going back shows what you did).
 */
import { useId, useState } from 'react';
import { CheckCircle, XCircle, Lightbulb, Play, ArrowCounterClockwise, Eye } from '@phosphor-icons/react';

import { Button } from '../../ui/index.js';
import Editor from '../../components/Editor.jsx';
import { run, judge } from '../../lib/run/index.js';
import { normOutput, normAnswer, judgedSource } from '../../../shared/next/learn/schema.js';
import { explainError } from '../../../shared/next/learn/errors.js';
import Markdown, { CodeBlock } from './Markdown.jsx';
import Diagram from './Diagram.jsx';

const PHASE = { loading: 'Loading Java. The first run takes a few seconds.', compiling: 'Compiling', running: 'Running' };

function Phase({ phase }) {
  return phase ? <span className="lr-phase" role="status">{PHASE[phase] || 'Working'}</span> : null;
}

/** Plain-English notes for an error, then the raw text. */
function ErrorNote({ text }) {
  const help = explainError(text);
  return (
    <div className="lr-err" role="alert">
      {help.length > 0 && (
        <div className="lr-err__help">
          {help.map((h, i) => <Markdown key={i} text={h} />)}
        </div>
      )}
      <pre className="lr-out lr-out--err">{text.trim()}</pre>
    </div>
  );
}

function Output({ r }) {
  if (r.failed) return <ErrorNote text={r.failed} />;
  if (r.compileError) return <ErrorNote text={r.compileError} />;
  return (
    <div className="lr-result">
      <div className="lr-result__label">Output</div>
      <pre className="lr-out">{r.stdout || ' '}</pre>
      {r.stderr && <ErrorNote text={r.stderr} />}
    </div>
  );
}

async function safeRun(args) {
  try {
    return await run(args);
  } catch (e) {
    return { failed: e?.message || 'The runner did not start.' };
  }
}

/* --------------------------------- explain --------------------------------- */

export function ExplainStep({ s }) {
  return (
    <>
      <Markdown text={s.body} />
      {s.diagram && <Diagram d={s.diagram} />}
    </>
  );
}

/* --------------------------------- example --------------------------------- */

export function ExampleStep({ s, st, set, lang }) {
  const code = st.code ?? s.code;
  const [phase, setPhase] = useState(null);
  const go = async () => {
    if (phase) return;
    setPhase('compiling');
    const r = await safeRun({ lang, source: code, stdin: s.stdin || '', onPhase: setPhase });
    setPhase(null);
    set({ result: r, ran: true });
  };
  return (
    <>
      {s.body && <Markdown text={s.body} />}
      {s.editable ? (
        <Editor value={code} onChange={(v) => set({ code: v })} lang={lang} onRun={go} label="Example code you can edit" minHeight="6rem" maxHeight="32rem" />
      ) : (
        <CodeBlock code={s.code} label="Example code" />
      )}
      {s.stdin && (
        <div className="lr-result">
          <div className="lr-result__label">Input</div>
          <pre className="lr-out lr-out--in">{s.stdin}</pre>
        </div>
      )}
      <div className="lr-runbar">
        <Button variant="primary" icon={Play} onClick={go} disabled={Boolean(phase)}>Run</Button>
        {s.editable && code !== s.code && (
          <Button variant="ghost" icon={ArrowCounterClockwise} onClick={() => set({ code: s.code, result: null })}>Reset code</Button>
        )}
        <Phase phase={phase} />
      </div>
      {st.result && <Output r={st.result} />}
    </>
  );
}

/* --------------------------------- predict --------------------------------- */

export function PredictStep({ s, st, set, lang }) {
  const name = useId();
  const [phase, setPhase] = useState(null);
  const guess = st.guess ?? '';
  const right = st.submitted && normOutput(guess) === normOutput(s.output);
  const submit = async () => {
    set({ submitted: true });
    setPhase('compiling');
    const r = await safeRun({ lang, source: s.code, stdin: s.stdin || '', onPhase: setPhase });
    setPhase(null);
    // The lesson's output is verified against this compiler; fall back to it if the runner cannot start.
    set({ submitted: true, result: r.failed ? { stdout: s.output } : r });
  };
  return (
    <>
      <Markdown text={s.body || 'What does this print? Commit to a guess before you run it.'} />
      <CodeBlock code={s.code} label="Code to predict" />
      {s.choices ? (
        <fieldset className="lr-choices" disabled={st.submitted}>
          <legend>Your guess</legend>
          {s.choices.map((c, i) => (
            <label key={i} className={`lr-choice${guess === c ? ' is-on' : ''}${st.submitted && normOutput(c) === normOutput(s.output) ? ' is-right' : ''}`}>
              <input type="radio" name={name} checked={guess === c} onChange={() => set({ guess: c })} />
              <pre>{c.replace(/\n$/, '') || ' '}</pre>
            </label>
          ))}
        </fieldset>
      ) : (
        <label className="lr-field">
          <span>Type the output, one line per line</span>
          <textarea
            className="lr-textarea"
            rows={Math.min(8, Math.max(2, s.output.split('\n').length))}
            value={guess}
            readOnly={st.submitted}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            onChange={(e) => set({ guess: e.target.value })}
          />
        </label>
      )}
      {!st.submitted ? (
        <div className="lr-runbar">
          <Button variant="primary" icon={Play} onClick={submit} disabled={!guess.trim()}>Check my guess</Button>
        </div>
      ) : (
        <div className="lr-reveal">
          <p className={`lr-verdict ${right ? 'is-right' : 'is-wrong'}`}>
            {right ? <CheckCircle size={20} weight="fill" aria-hidden="true" /> : <XCircle size={20} weight="fill" aria-hidden="true" />}
            {right ? 'You called it.' : 'Not quite. Here is what it really prints.'}
          </p>
          {phase ? <Phase phase={phase} /> : st.result && <Output r={st.result} />}
          <Markdown text={s.explain} />
          {!right && (
            <Button variant="ghost" onClick={() => set({ submitted: false, result: null })}>Try another guess</Button>
          )}
        </div>
      )}
    </>
  );
}

/* ---------------------------------- check ---------------------------------- */

export function CheckStep({ s, st, set }) {
  const picked = st.picked ?? [];
  if (s.options) {
    const last = picked.at(-1);
    return (
      <>
        <Markdown text={s.prompt} />
        {s.code && <CodeBlock code={s.code} label="Code for the question" />}
        <div className="lr-options" role="group" aria-label="Answer choices">
          {s.options.map((o, i) => {
            const tried = picked.includes(i);
            const state = tried ? (o.correct ? 'is-right' : 'is-wrong') : '';
            return (
              <div key={i} className={`lr-option ${state}`}>
                <button
                  type="button"
                  className="lr-option__btn"
                  aria-pressed={tried}
                  disabled={st.right && !tried}
                  onClick={() => set({ picked: tried ? picked : [...picked, i], answered: true, right: st.right || Boolean(o.correct) })}
                >
                  <span className="lr-option__mark" aria-hidden="true">{String.fromCharCode(65 + i)}</span>
                  <Markdown text={o.text} className="lr-md lr-md--tight" />
                </button>
                {tried && (
                  <div className="lr-why" aria-live={i === last ? 'polite' : undefined}>
                    <strong>{o.correct ? 'Correct. ' : 'Not this one. '}</strong>
                    <Markdown text={o.why} className="lr-md lr-md--inline" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {!st.right && picked.length > 0 && <p className="lr-note">Read why, then try another choice.</p>}
      </>
    );
  }
  const accepted = (Array.isArray(s.answer) ? s.answer : [s.answer]).map(normAnswer);
  const typed = st.typed ?? '';
  const right = st.answered && accepted.includes(normAnswer(st.lastTyped));
  return (
    <>
      <Markdown text={s.prompt} />
      {s.code && <CodeBlock code={s.code} label="Code for the question" />}
      <form
        className="lr-runbar"
        onSubmit={(e) => {
          e.preventDefault();
          if (typed.trim()) set({ answered: true, lastTyped: typed, right: accepted.includes(normAnswer(typed)) });
        }}
      >
        <label className="lr-field lr-field--row">
          <span className="lr-sr">Your answer</span>
          <input className="lr-input" value={typed} placeholder={s.placeholder || 'Your answer'} spellCheck={false} autoCapitalize="off" onChange={(e) => set({ typed: e.target.value })} />
        </label>
        <Button variant="primary" type="submit" disabled={!typed.trim()}>Check</Button>
      </form>
      {st.answered && (
        <div className={`lr-why ${right ? 'is-right' : 'is-wrong'}`} aria-live="polite">
          <strong>{right ? 'Correct. ' : `Not quite. The answer is ${Array.isArray(s.answer) ? s.answer[0] : s.answer}. `}</strong>
          <Markdown text={s.why} className="lr-md lr-md--inline" />
        </div>
      )}
    </>
  );
}

/* --------------------------------- exercise -------------------------------- */

export function ExerciseStep({ s, st, set, lang, onPass, saveDraft }) {
  const code = st.code ?? s.starter;
  const [phase, setPhase] = useState(null);
  const hints = st.hints ?? 0;
  const attempts = st.attempts ?? 0;
  const res = st.result;
  const canSolution = st.passed || attempts >= 2;

  const go = async () => {
    if (phase) return;
    setPhase('compiling');
    let r;
    try {
      r = await judge({ lang, source: judgedSource(s, code), cases: s.tests.map((t) => ({ stdin: t.stdin || '', stdout: t.stdout })), onPhase: setPhase });
    } catch (e) {
      r = { passed: false, results: [], compileError: e?.message || 'The runner did not start.' };
    }
    setPhase(null);
    set({ result: r, attempts: attempts + 1, passed: st.passed || r.passed });
    if (r.passed) onPass();
  };
  const change = (v) => {
    set({ code: v });
    saveDraft(v);
  };

  const ok = res?.results?.filter((x) => x.ok).length ?? 0;
  return (
    <>
      <Markdown text={s.body} />
      <Editor value={code} onChange={change} lang={lang} onRun={go} label="Your code" minHeight="12rem" maxHeight="40rem" diagnostics={res?.diagnostics} />
      <div className="lr-runbar">
        <Button variant="primary" icon={Play} onClick={go} disabled={Boolean(phase)}>Run the tests</Button>
        <Button variant="ghost" icon={Lightbulb} onClick={() => set({ hints: hints + 1 })} disabled={hints >= s.hints.length}>
          {hints >= s.hints.length ? 'No more hints' : `Hint ${hints + 1} of ${s.hints.length}`}
        </Button>
        {code !== s.starter && (
          <Button variant="ghost" icon={ArrowCounterClockwise} onClick={() => change(s.starter)}>Start over</Button>
        )}
        <Phase phase={phase} />
      </div>

      {hints > 0 && (
        <ol className="lr-hints">
          {s.hints.slice(0, hints).map((h, i) => <li key={i}><Markdown text={h} /></li>)}
        </ol>
      )}

      {res && (
        <div className="lr-tests" aria-live="polite">
          {res.compileError ? (
            <>
              <p className="lr-verdict is-wrong"><XCircle size={20} weight="fill" aria-hidden="true" />It did not compile.</p>
              <ErrorNote text={res.compileError} />
            </>
          ) : (
            <>
              <p className={`lr-verdict ${res.passed ? 'is-right' : 'is-wrong'}`}>
                {res.passed ? <CheckCircle size={20} weight="fill" aria-hidden="true" /> : <XCircle size={20} weight="fill" aria-hidden="true" />}
                {res.passed ? `All ${s.tests.length} tests pass. Nicely done.` : `${ok} of ${s.tests.length} tests pass.`}
              </p>
              <ul className="lr-testlist">
                {s.tests.map((t, i) => {
                  const r = res.results[i];
                  return (
                    <li key={i} className={r?.ok ? 'is-right' : 'is-wrong'}>
                      <div className="lr-test__h">
                        {r?.ok ? <CheckCircle size={18} weight="fill" aria-label="passed" /> : <XCircle size={18} weight="fill" aria-label="failed" />}
                        <span>{t.name}</span>
                      </div>
                      {t.rubric && <p className="lr-rubric">{t.rubric}</p>}
                      {r && !r.ok && (
                        <div className="lr-test__d">
                          {t.stdin && <div><div className="lr-result__label">Input</div><pre className="lr-out lr-out--in">{t.stdin}</pre></div>}
                          <div><div className="lr-result__label">Expected</div><pre className="lr-out">{t.stdout || ' '}</pre></div>
                          <div><div className="lr-result__label">Your program printed</div><pre className="lr-out">{r.stdout || ' '}</pre></div>
                          {r.stderr && <ErrorNote text={r.stderr} />}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}

      {s.harness && (
        <details className="lr-details">
          <summary>How this is tested</summary>
          <p className="lr-note">Your class is compiled together with this tester, which reads each test's input, calls your code and prints the result.</p>
          <CodeBlock code={s.harness} label="Test harness" />
        </details>
      )}
      {canSolution && (
        <details className="lr-details" open={st.solutionOpen} onToggle={(e) => set({ solutionOpen: e.currentTarget.open })}>
          <summary><Eye size={16} aria-hidden="true" /> {st.passed ? 'Compare with our solution' : 'Show a solution'}</summary>
          {!st.passed && <p className="lr-note">Read it, close it, then type your own version from memory. That is how it sticks.</p>}
          <CodeBlock code={s.solution} label="Reference solution" />
        </details>
      )}
    </>
  );
}

/* ---------------------------------- recap ---------------------------------- */

export function RecapStep({ s }) {
  return (
    <div className="lr-recap">
      <section>
        <h3>Remember</h3>
        <ul>{s.takeaways.map((t, i) => <li key={i}><Markdown text={t} className="lr-md lr-md--inline" /></li>)}</ul>
      </section>
      <section>
        <h3>Mistakes to avoid</h3>
        <ul>{s.mistakes.map((t, i) => <li key={i}><Markdown text={t} className="lr-md lr-md--inline" /></li>)}</ul>
      </section>
    </div>
  );
}

export const STEP_TITLE = {
  explain: 'Read',
  example: 'Run it',
  predict: 'Predict the output',
  check: 'Check yourself',
  exercise: 'Your turn',
  recap: 'Recap',
};

/** Can the student move on from this step yet? */
export function stepReady(s, st) {
  if (s.kind === 'predict') return Boolean(st.submitted);
  if (s.kind === 'check') return Boolean(st.answered);
  return true;
}
