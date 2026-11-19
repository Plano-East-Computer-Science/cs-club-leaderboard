/**
 * Compiles and runs one student's Java program with TeaVM's javac compiled to
 * WebAssembly (self-hosted under /teavm/, see docs/v3c-java-ide.md).
 *
 * No browser APIs here: the worker (java.worker.js) and the Node tests both
 * pass in TeaVM's `load` and the file bytes.
 *
 *   const engine = await createJavaEngine({ load, files })
 *   engine.compile(source) -> { ok, diagnostics, fileName, timeMs }
 *   engine.run(stdin)      -> { stdout, stderr, exitCode, timeMs, diagnostics }
 */
import { prepareJava, wrapperSource, javaFileName } from './javaSource.js';
import { javacDiagnostics, javaNameForTrap, userFrames, javaTraceLine } from './errors.js';

const MAX_OUTPUT = 1 << 20; // characters per stream; a print loop should not freeze the tab

class OutputLimit extends Error {}

export async function createJavaEngine({ load, files }) {
  const teavm = await load(files.compiler);
  const compiler = teavm.exports.createCompiler();
  compiler.setSdk(files.sdk);
  compiler.setTeaVMClasslib(files.classlib);
  let raw = [];
  compiler.onDiagnostic((d) => raw.push({
    type: d.type,
    severity: d.severity,
    fileName: d.fileName,
    lineNumber: d.lineNumber,
    columnNumber: d.type === 'javac' ? d.columnNumber : -1,
    message: d.message,
  }));

  let built = null; // { source, wasm, module, fileName }
  let deob = null;

  async function compile(source) {
    if (built?.source === source) return { ok: true, diagnostics: [], fileName: built.fileName, timeMs: 0, cached: true };
    built = null;
    const t0 = performance.now();
    const fileName = javaFileName(source);
    const { source: prepared, lines } = prepareJava(source);
    const fail = (diagnostics) => ({ ok: false, diagnostics, fileName, timeMs: Math.round(performance.now() - t0) });

    raw = [];
    compiler.clearSourceFiles();
    compiler.clearOutputFiles();
    compiler.addSourceFile(fileName, prepared);
    if (!compiler.compile()) return fail(javacDiagnostics(raw, lines, fileName));

    const mains = [...compiler.detectMainClasses()].filter((n) => !n.endsWith('$Run'));
    if (!mains.length) {
      return fail([{ line: null, col: null, severity: 'error', message: 'No main method found. Add public static void main(String[] args) to your class.' }]);
    }
    const base = fileName.replace(/\.java$/, '');
    const main = mains.find((n) => n === base || n.endsWith(`.${base}`)) || mains[0];

    raw = [];
    compiler.addSourceFile('$Run.java', wrapperSource(main, fileName, lines));
    if (!compiler.compile()) return fail(javacDiagnostics(raw, lines, fileName));
    const dot = main.lastIndexOf('.');
    const ok = await compiler.generateWebAssembly({
      outputName: 'app',
      mainClass: `${dot > 0 ? main.slice(0, dot + 1) : ''}$Run`,
      obfuscated: false, // keeps names so a crash can be traced back to a line
    });
    if (!ok) return fail(javacDiagnostics(raw, lines, fileName));
    const wasm = compiler.getWebAssemblyOutputFile('app.wasm');
    built = { source, wasm, fileName, lines, module: null };
    return { ok: true, diagnostics: [], fileName, timeMs: Math.round(performance.now() - t0) };
  }

  /** Frames for a WebAssembly trap, via TeaVM's stack deobfuscator. */
  async function trapFrames(error) {
    if (!files.deobfuscator || !error?.stack) return [];
    try {
      // The deobfuscator is itself a TeaVM module, so TeaVM's loader sets up its imports.
      deob ??= (await load(files.deobfuscator)).exports;
      built.module ??= await WebAssembly.compile(built.wasm, { builtins: ['js-string'] });
      const offsets = [...error.stack.matchAll(/wasm-function\[\d+\]:0x([0-9a-f]+)/g)].map((m) => parseInt(m[1], 16));
      return [...deob.createForModule(built.module).deobfuscate(offsets)];
    } catch {
      return [];
    }
  }

  async function run(stdin = '') {
    if (!built) throw new Error('Compile first.');
    let stdout = '';
    let stderr = '';
    const put = (which) => (ch) => {
      if (which === 1) stdout += String.fromCharCode(ch);
      else stderr += String.fromCharCode(ch);
      if (stdout.length + stderr.length > MAX_OUTPUT) throw new OutputLimit();
    };
    let t0 = performance.now();
    let exitCode = 0;
    try {
      const app = await load(built.wasm, {
        // Lets Java's own stack traces name the student's lines.
        stackDeobfuscator: files.deobfuscator ? { enabled: true, path: files.deobfuscator } : undefined,
        installImports(o) {
          o.teavmConsole.putcharStdout = put(1);
          o.teavmConsole.putcharStderr = put(2);
        },
      });
      t0 = performance.now();
      app.exports.main([String(stdin)]);
    } catch (e) {
      exitCode = 1;
      if (e instanceof OutputLimit) {
        stderr += `\nStopped: printed more than ${MAX_OUTPUT / 1024} KB.`;
      } else if (e instanceof WebAssembly.RuntimeError || e instanceof RangeError || e?.name === 'InternalError') {
        // Traps never reach Java's catch blocks, so the wrapper could not print them.
        const all = await trapFrames(e);
        const frames = userFrames(all, built.fileName, built.lines);
        const name = all[0]?.className === 'java.lang.Object' && all[0]?.method === 'clone'
          ? 'java.lang.UnsupportedOperationException: array.clone() does not work in the browser runner yet. Use Arrays.copyOf(a, a.length).'
          : javaNameForTrap(e.message);
        stderr += `${stderr && !stderr.endsWith('\n') ? '\n' : ''}Exception in thread "main" ${name}${frames.length ? `\n${frames.join('\n')}` : ''}\n`;
      }
      // Otherwise it is the $Exit the wrapper throws after printing the exception itself.
    }
    const timeMs = Math.round(performance.now() - t0);
    const line = exitCode ? javaTraceLine(stderr, built.fileName) : null;
    const diagnostics = line ? [{ line, col: null, severity: 'error', message: stderr.trim().split('\n')[0] }] : [];
    return { stdout, stderr, exitCode, timeMs, diagnostics };
  }

  return { compile, run };
}
