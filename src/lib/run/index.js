/**
 * One way to run student code, whatever the language (v2 spec section 6).
 *
 *   run({ lang, source, stdin, timeoutMs, onPhase })
 *     -> { stdout, stderr, exitCode, timeMs, timedOut, diagnostics, compileError? }
 *   judge({ lang, source, cases, timeoutMs, onPhase })
 *     -> { passed, results: [{ ok, stdout, stderr, expected, exitCode, timeMs, timedOut }], diagnostics, compileError? }
 *
 * `diagnostics` is [{ line, col, message, severity }] for the editor's inline
 * markers. `compileError` is set (javac-style text) when the program never ran.
 * `onPhase` hears 'loading' (first run only), 'compiling', 'running'.
 *
 * Python runs in Pyodide (../pyrunner.js), Java in TeaVM's javac compiled to
 * WebAssembly (./java.js). Both are self-hosted and run in a worker.
 */
import * as py from '../pyrunner.js';
import { runJava, warmUp as warmJava, isReady as javaReady } from './java.js';
import { formatDiagnostics, pythonError } from './errors.js';

export const LANGS = [
  { id: 'java', label: 'Java' },
  { id: 'python', label: 'Python' },
];

const norm = (s) => String(s ?? '').replace(/\r\n/g, '\n').trimEnd();

export function warmUp(lang) {
  return lang === 'java' ? warmJava() : py.warmUp();
}

export function isReady(lang) {
  return lang === 'java' ? javaReady() : py.isReady();
}

function check(lang) {
  if (lang !== 'java' && lang !== 'python') throw new Error(`Unknown language: ${lang}`);
}

/** Python's SyntaxError is its "compile error": the program never started. */
export function pythonResult(r, timeMs) {
  const err = pythonError(r.stderr);
  const syntax = /^\s*(SyntaxError|IndentationError|TabError)\b/m.test(r.stderr || '');
  return {
    stdout: r.stdout,
    stderr: r.stderr,
    exitCode: r.stderr ? 1 : 0,
    timeMs,
    timedOut: r.timedOut,
    diagnostics: err ? [{ line: err.line, col: null, message: err.message, severity: 'error' }] : [],
    ...(syntax ? { compileError: r.stderr } : {}),
  };
}

export async function run({ lang, source, stdin = '', timeoutMs = 5000, onPhase } = {}) {
  check(lang);
  if (lang === 'python') {
    onPhase?.(py.isReady() ? 'running' : 'loading');
    await py.warmUp();
    onPhase?.('running');
    const t0 = performance.now();
    const [r] = await py.runCases(source, [{ stdin, stdout: '' }], { timeoutMs });
    return pythonResult(r, Math.round(performance.now() - t0));
  }
  const { compile, results } = await runJava(source, [stdin], { timeoutMs, onPhase });
  if (!compile.ok) return compileFailure(compile);
  const r = results[0];
  return { stdout: r.stdout, stderr: r.stderr, exitCode: r.exitCode, timeMs: r.timeMs, timedOut: r.timedOut, diagnostics: r.diagnostics || [] };
}

export function compileFailure(compile) {
  return {
    stdout: '',
    stderr: '',
    exitCode: 1,
    timeMs: 0,
    timedOut: false,
    diagnostics: compile.diagnostics,
    compileError: formatDiagnostics(compile.diagnostics, compile.fileName || 'Main.java') || 'Compile failed.',
  };
}

export async function judge({ lang, source, cases = [], timeoutMs = 5000, onPhase } = {}) {
  check(lang);
  if (lang === 'python') {
    onPhase?.(py.isReady() ? 'running' : 'loading');
    await py.warmUp();
    onPhase?.('running');
    const res = await py.runCases(source, cases, { timeoutMs });
    const results = res.map((r) => ({ ...r, exitCode: r.stderr ? 1 : 0, timeMs: null }));
    const firstErr = results.map((r) => pythonResult(r, null)).find((r) => r.diagnostics.length || r.compileError);
    return {
      passed: results.length > 0 && results.every((r) => r.ok),
      results,
      diagnostics: firstErr?.diagnostics || [],
      ...(firstErr?.compileError ? { compileError: firstErr.compileError } : {}),
    };
  }
  const { compile, results: runs } = await runJava(source, cases.map((c) => c.stdin ?? ''), { timeoutMs, onPhase });
  return javaJudge(cases, compile, runs);
}

/** Java compile + per-case runs -> judge()'s result. Exported for the tests. */
export function javaJudge(cases, compile, runs) {
  if (!compile.ok) {
    const f = compileFailure(compile);
    return { passed: false, results: [], diagnostics: f.diagnostics, compileError: f.compileError };
  }
  const results = runs.map((r, i) => {
    const expected = cases[i].stdout ?? '';
    return {
      ok: !r.timedOut && r.exitCode === 0 && norm(r.stdout) === norm(expected),
      stdout: r.stdout,
      stderr: r.stderr,
      expected,
      exitCode: r.exitCode,
      timeMs: r.timeMs,
      timedOut: r.timedOut,
    };
  });
  return {
    passed: results.length > 0 && results.every((r) => r.ok),
    results,
    diagnostics: runs.find((r) => r.diagnostics?.length)?.diagnostics || [],
  };
}
