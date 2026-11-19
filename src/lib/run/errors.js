/**
 * Turns compiler and runtime errors into editor diagnostics
 * ({ line, col, message, severity }) and readable text. Pure, shared by the
 * runners, the workers and the tests.
 */

/** javac diagnostics from TeaVM -> editor diagnostics, dropping anything past the student's own lines. */
export function javacDiagnostics(raw, userLines, fileName) {
  const out = [];
  for (const d of raw) {
    if (d.severity !== 'error' && d.severity !== 'warning') continue;
    const line = Number(d.lineNumber);
    const known = d.fileName === fileName && Number.isFinite(line) && line >= 1 && line <= userLines;
    // TeaVM (not javac) problems point into its class library, not the student's file.
    const message = String(d.message || '').trim();
    out.push({
      line: known ? line : null,
      col: known && d.columnNumber > 0 ? Number(d.columnNumber) : null,
      message: d.type === 'teavm' && !known ? `${message} (this part of Java is not supported in the browser runner)` : message,
      severity: d.severity,
    });
  }
  return out;
}

/** Diagnostics -> the text javac would print, e.g. "Main.java:4: error: ';' expected". */
export function formatDiagnostics(diags, fileName) {
  return diags
    .map((d) => `${d.line ? `${fileName}:${d.line}: ` : ''}${d.severity === 'warning' ? 'warning' : 'error'}: ${d.message}`)
    .join('\n');
}

// Browser messages for WebAssembly traps (Chrome, Firefox, Safari wording), as Java would name them.
const TRAPS = [
  [/array element access out of bounds|index out of bounds|out of bounds array access/i, 'java.lang.ArrayIndexOutOfBoundsException'],
  [/null pointer|null reference|dereferenc.*null|null structure|null array/i, 'java.lang.NullPointerException'],
  [/divide by zero|division by zero|remainder by zero/i, 'java.lang.ArithmeticException: / by zero'],
  [/call stack|too much recursion|stack overflow/i, 'java.lang.StackOverflowError'],
  [/illegal cast|bad cast|cast failure/i, 'java.lang.ClassCastException'],
  [/out of memory|allocation failed|could not allocate|array buffer allocation/i, 'java.lang.OutOfMemoryError'],
];

/** A WebAssembly trap or engine error message -> a Java exception name (with detail when Java has one). */
export function javaNameForTrap(message) {
  const m = String(message || '');
  for (const [re, name] of TRAPS) if (re.test(m)) return name;
  return `java.lang.Error: ${m || 'the program crashed'}`;
}

/**
 * Deobfuscated frames -> "\tat Main.main(Main.java:5)" lines for the
 * student's own lines only (not the appended Scanner), at most 12.
 */
export function userFrames(frames, fileName, userLines = Infinity) {
  return (frames || [])
    .filter((f) => f && f.file === fileName && f.line > 0 && f.line <= userLines)
    .slice(0, 12)
    .map((f) => `\tat ${f.className}.${f.method}(${f.file}:${f.line})`);
}

/** First "(Main.java:12)" in a Java stack trace -> 12. */
export function javaTraceLine(text, fileName) {
  const esc = fileName.replace(/[.$]/g, '\\$&');
  const m = new RegExp(`\\(${esc}:(\\d+)\\)`).exec(String(text || ''));
  return m ? Number(m[1]) : null;
}

/** Python traceback -> { line, message } for the last frame in the student's file, or null. */
export function pythonError(stderr) {
  const text = String(stderr || '').trimEnd();
  if (!text) return null;
  const lines = [...text.matchAll(/File "your_code\.py", line (\d+)/g)];
  if (!lines.length) return null;
  const last = text.split('\n').filter((l) => l.trim()).pop();
  return { line: Number(lines[lines.length - 1][1]), message: last.trim() };
}
