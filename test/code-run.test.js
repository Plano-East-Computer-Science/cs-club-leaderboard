/**
 * V3-C code runner, pure parts: Java source preparation, error parsing, and
 * the result shapes of run()/judge() (src/lib/run/). The real compiler is
 * exercised in java-engine.test.js.
 */
import assert from 'node:assert/strict';
import { prepareJava, maskJava, javaFileName, wrapperSource } from '../src/lib/run/javaSource.js';
import {
  javacDiagnostics, formatDiagnostics, javaNameForTrap, userFrames, javaTraceLine, pythonError,
} from '../src/lib/run/errors.js';
import { pythonResult, compileFailure, javaJudge } from '../src/lib/run/index.js';

// --- prepareJava: every rewrite keeps each line the same length --------------------------------
const src = [
  'import java.util.Scanner;',
  'import java.io.InputStreamReader;',
  'import java.util.*;',
  'public class Main {',
  '  public static void main(String[] args) {',
  '    java.util.Scanner a = new java.util.Scanner(System.in);',
  '    String s = "System.in and System.exit(1) stay";',
  '    // System.exit(2) in a comment stays',
  "    char c = '\"'; /* System.in */",
  '    if (a.hasNext()) System.exit(0);',
  '    var r = new BufferedReader(new InputStreamReader(System . in));',
  '  }',
  '}',
].join('\n');
const { source: out, lines } = prepareJava(src);
assert.equal(lines, 13);
const userPart = out.split('\n').slice(0, lines);
assert.deepEqual(userPart.map((l) => l.length), src.split('\n').map((l) => l.length), 'line lengths unchanged, so javac columns line up');
assert.equal(userPart[0].trim(), '', 'Scanner import blanked');
assert.equal(userPart[1].trim(), '', 'InputStreamReader import blanked');
assert.equal(userPart[2], 'import java.util.*;', 'other imports kept');
assert.match(userPart[5], /^\s+Scanner a = new\s+Scanner\(\$Stdin\.in\);$/);
assert.equal(userPart[6], src.split('\n')[6], 'string literal untouched');
assert.equal(userPart[7], src.split('\n')[7], 'comment untouched');
assert.equal(userPart[8], src.split('\n')[8], 'char literal and block comment untouched');
assert.match(userPart[9], /\$Stdin\.exit\(0\)/);
assert.match(userPart[10], /InputStreamReader\(\$Stdin\.in\s*\)/);
assert.match(out, /class Scanner implements/, 'Scanner shim appended');
assert.match(out, /class InputStreamReader extends java\.io\.Reader/, 'reader shim appended');
assert.equal(prepareJava('a\r\nb').lines, 2, 'CRLF counted as one line break');

// masking keeps length and newlines
const m = maskJava('x = "a\\"b"; // c\ny = """\nq\n""";');
assert.equal(m.length, 'x = "a\\"b"; // c\ny = """\nq\n""";'.length);
assert.equal(m.split('\n').length, 4);
assert.ok(!/[abcq"]/.test(m.replace(/x|y/g, '')), 'literal and comment text masked');

// file name follows the public class
assert.equal(javaFileName('public class Solution { }'), 'Solution.java');
assert.equal(javaFileName('public final class Fast {}'), 'Fast.java');
assert.equal(javaFileName('class Main {}'), 'Main.java');
assert.equal(javaFileName('// public class Fake\nclass X {}'), 'Main.java', 'comments ignored');

// wrapper calls the student's class and keeps the package
const w = wrapperSource('Main', 'Main.java', 20);
assert.match(w, /Main\.main\(new String\[0\]\)/);
assert.match(w, /getLineNumber\(\) <= 20/);
assert.match(wrapperSource('pkg.Main'), /^package pkg;/);

// --- javac diagnostics -----------------------------------------------------------------------
const raw = [
  { type: 'javac', severity: 'error', fileName: 'Main.java', lineNumber: 5, columnNumber: 29, message: "';' expected" },
  { type: 'javac', severity: 'error', fileName: 'Main.java', lineNumber: 40, columnNumber: 3, message: 'in the prelude' },
  { type: 'javac', severity: 'error', fileName: '$Run.java', lineNumber: 4, columnNumber: 3, message: 'in the wrapper' },
  { type: 'javac', severity: 'other', fileName: 'Main.java', lineNumber: 1, columnNumber: 1, message: 'note' },
  { type: 'teavm', severity: 'error', fileName: 'TFoo.java', lineNumber: 9, columnNumber: -1, message: 'Method not found' },
];
const diags = javacDiagnostics(raw, 12, 'Main.java');
assert.equal(diags.length, 4, 'notes dropped');
assert.deepEqual(diags[0], { line: 5, col: 29, message: "';' expected", severity: 'error' });
assert.equal(diags[1].line, null, 'prelude lines are not the student\'s');
assert.equal(diags[2].line, null, 'wrapper file is not the student\'s');
assert.match(diags[3].message, /not supported in the browser runner/);
assert.equal(
  formatDiagnostics(diags.slice(0, 2), 'Main.java'),
  "Main.java:5: error: ';' expected\nerror: in the prelude",
);

// --- runtime errors ----------------------------------------------------------------------------
assert.equal(javaNameForTrap('array element access out of bounds'), 'java.lang.ArrayIndexOutOfBoundsException');
assert.equal(javaNameForTrap('index out of bounds'), 'java.lang.ArrayIndexOutOfBoundsException');
assert.equal(javaNameForTrap('dereferencing a null pointer'), 'java.lang.NullPointerException');
assert.equal(javaNameForTrap('divide by zero'), 'java.lang.ArithmeticException: / by zero');
assert.equal(javaNameForTrap('Maximum call stack size exceeded'), 'java.lang.StackOverflowError');
assert.equal(javaNameForTrap('too much recursion'), 'java.lang.StackOverflowError');
assert.equal(javaNameForTrap('something new'), 'java.lang.Error: something new');

const frames = [
  { className: 'java.lang.Object', method: 'clone', file: 'TObject.java', line: 356 },
  { className: 'Scanner', method: 'token', file: 'Main.java', line: 99 },
  { className: 'Main', method: 'f', file: 'Main.java', line: 3 },
  { className: 'Main', method: 'main', file: 'Main.java', line: 8 },
  { className: '$Run', method: 'main', file: '$Run.java', line: 5 },
];
assert.deepEqual(userFrames(frames, 'Main.java', 20), ['\tat Main.f(Main.java:3)', '\tat Main.main(Main.java:8)']);
assert.equal(userFrames(Array(40).fill(frames[2]), 'Main.java', 20).length, 12, 'deep recursion capped');
assert.equal(javaTraceLine('Exception in thread "main" x\n\tat Main.f(Main.java:3)\n\tat Main.main(Main.java:8)', 'Main.java'), 3);
assert.equal(javaTraceLine('no trace', 'Main.java'), null);

const tb = 'Traceback (most recent call last):\n  File "your_code.py", line 2, in <module>\n  File "your_code.py", line 7, in f\nZeroDivisionError: division by zero\n';
assert.deepEqual(pythonError(tb), { line: 7, message: 'ZeroDivisionError: division by zero' });
assert.equal(pythonError(''), null);
assert.equal(pythonError('oops'), null);

// --- result shapes -----------------------------------------------------------------------------
const SHAPE = ['stdout', 'stderr', 'exitCode', 'timeMs', 'timedOut', 'diagnostics'];
const syntax = pythonResult({ stdout: '', stderr: '  File "your_code.py", line 2\n    print(n +)\nSyntaxError: invalid syntax\n', timedOut: false }, 4);
for (const k of SHAPE) assert.ok(k in syntax, `run() result has ${k}`);
assert.equal(syntax.exitCode, 1);
assert.equal(syntax.diagnostics[0].line, 2);
assert.ok(syntax.compileError, 'a SyntaxError is a compile error');
const okPy = pythonResult({ stdout: '3\n', stderr: '', timedOut: false }, 4);
assert.equal(okPy.exitCode, 0);
assert.ok(!('compileError' in okPy));

const cf = compileFailure({ ok: false, fileName: 'Main.java', diagnostics: [diags[0]] });
for (const k of SHAPE) assert.ok(k in cf);
assert.equal(cf.compileError, "Main.java:5: error: ';' expected");

const cases = [{ stdin: '1', stdout: '2\n' }, { stdin: '2', stdout: '4' }, { stdin: '3', stdout: '6' }];
const run = (stdout, extra = {}) => ({ stdout, stderr: '', exitCode: 0, timeMs: 3, timedOut: false, diagnostics: [], ...extra });
const j = javaJudge(cases, { ok: true }, [run('2'), run('4\r\n'), run('6', { exitCode: 1, stderr: 'boom', diagnostics: [{ line: 4 }] })]);
assert.equal(j.passed, false);
assert.deepEqual(j.results.map((r) => r.ok), [true, true, false], 'trailing whitespace and CRLF ignored; a crash fails');
assert.deepEqual(Object.keys(j.results[0]).sort(), ['exitCode', 'expected', 'ok', 'stderr', 'stdout', 'timeMs', 'timedOut']);
assert.deepEqual(j.diagnostics, [{ line: 4 }]);
assert.equal(javaJudge(cases.slice(0, 1), { ok: true }, [run('2')]).passed, true);
const jc = javaJudge(cases, { ok: false, fileName: 'Main.java', diagnostics: [diags[0]] }, []);
assert.equal(jc.passed, false);
assert.deepEqual(jc.results, []);
assert.match(jc.compileError, /';' expected/);
assert.equal(javaJudge([], { ok: true }, []).passed, false, 'no cases never counts as passed');

console.log('run tests passed');
