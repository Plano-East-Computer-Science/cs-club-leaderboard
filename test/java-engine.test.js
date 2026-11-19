/**
 * V3-C: the real in-browser Java compiler (public/teavm) run under Node.
 * Compiles and runs contest-style programs: Scanner and BufferedReader on
 * stdin, printf, a compile error with line and column, an uncaught exception
 * with its line, System.exit, a class not named Main. About 10 s.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dir = new URL('../public/teavm/', import.meta.url);

// The compiler uses WebAssembly exception references; Node 24 has them behind a flag.
const EXNREF = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 10, 8, 1, 6, 0, 31, 64, 0, 11, 11]);
if (!WebAssembly.validate(EXNREF) && !process.execArgv.includes('--experimental-wasm-exnref')) {
  const r = spawnSync(process.execPath, ['--experimental-wasm-exnref', ...process.execArgv, fileURLToPath(import.meta.url)], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

const { load } = await import(new URL('compiler.wasm-runtime.js', dir).href);
const { createJavaEngine } = await import(pathToFileURL(fileURLToPath(new URL('../src/lib/run/javaEngine.js', import.meta.url))).href);
const read = (f) => new Int8Array(fs.readFileSync(new URL(f, dir)));
const engine = await createJavaEngine({
  load,
  files: {
    compiler: read('compiler.wasm'),
    sdk: read('compile-classlib-teavm.bin'),
    classlib: read('runtime-classlib-teavm.bin'),
    deobfuscator: read('deobfuscator.wasm'),
  },
});

async function java(source, stdin = '') {
  const c = await engine.compile(source);
  if (!c.ok) return { compile: c };
  return { compile: c, run: await engine.run(stdin) };
}

// Scanner: tokens, nextLine after nextInt, hasNext, doubles, printf.
let r = await java(`import java.util.Scanner;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        long sum = 0;
        for (int i = 0; i < n; i++) sum += sc.nextLong();
        sc.nextLine();
        String name = sc.nextLine();
        double d = sc.nextDouble();
        System.out.printf("%d %s %.2f %b%n", sum, name, d / 3, sc.hasNext());
    }
}
`, '3\n1 2 3\nAda Lovelace\n2.5\n');
assert.ok(r.compile.ok, JSON.stringify(r.compile.diagnostics));
assert.equal(r.run.stdout, '6 Ada Lovelace 0.83 false\n');
assert.equal(r.run.exitCode, 0);

// The same source runs again without recompiling, on new input.
const again = await engine.compile(r.compile && `import java.util.Scanner;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        long sum = 0;
        for (int i = 0; i < n; i++) sum += sc.nextLong();
        sc.nextLine();
        String name = sc.nextLine();
        double d = sc.nextDouble();
        System.out.printf("%d %s %.2f %b%n", sum, name, d / 3, sc.hasNext());
    }
}
`);
assert.equal(again.cached, true);
assert.equal((await engine.run('1\n5\nBo\n3 extra\n')).stdout, '5 Bo 1.00 true\n');

// BufferedReader + StringTokenizer + PrintWriter, the fast-I/O idiom.
r = await java(`import java.io.*;
import java.util.*;
public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        StringTokenizer st = new StringTokenizer(br.readLine());
        int a = Integer.parseInt(st.nextToken()), b = Integer.parseInt(st.nextToken());
        int lines = 0;
        String line;
        while ((line = br.readLine()) != null) lines++;
        PrintWriter out = new PrintWriter(new BufferedWriter(new OutputStreamWriter(System.out)));
        out.println(a + b);
        out.println(lines);
        out.flush();
    }
}
`, '4 5\nx\ny\n');
assert.equal(r.run.stdout, '9\n2\n');

// Compile error: javac's line and column, on the student's own text.
r = await java(`public class Main {
    public static void main(String[] args) {
        int x = 1
        System.out.println(x);
    }
}
`);
assert.equal(r.compile.ok, false);
assert.deepEqual(r.compile.diagnostics[0], { line: 3, col: 18, message: "';' expected", severity: 'error' });

r = await java(`public class Main {
    public static void main(String[] args) {
        String s = 5;
    }
}
`);
assert.equal(r.compile.diagnostics[0].line, 3);
assert.match(r.compile.diagnostics[0].message, /incompatible types/);

// Uncaught exceptions: thrown by Java, and a WebAssembly trap (array index), both name the line.
r = await java(`public class Main {
    public static void main(String[] args) {
        System.out.println("start");
        throw new IllegalStateException("bad input");
    }
}
`);
assert.equal(r.run.stdout, 'start\n');
assert.equal(r.run.exitCode, 1);
assert.match(r.run.stderr, /^Exception in thread "main" java\.lang\.IllegalStateException: bad input\n\tat Main\.main\(Main\.java:4\)/);
assert.equal(r.run.diagnostics[0].line, 4);

r = await java(`public class Main {
    static int f(int[] a, int i) {
        return a[i];
    }
    public static void main(String[] args) {
        System.out.println(f(new int[3], 5));
    }
}
`);
assert.match(r.run.stderr, /ArrayIndexOutOfBoundsException\n\tat Main\.f\(Main\.java:3\)\n\tat Main\.main\(Main\.java:6\)/);
assert.equal(r.run.diagnostics[0].line, 3);

// Running out of input is Java's NoSuchElementException, pointing at the student's line, not the shim's.
r = await java(`import java.util.*;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.println(sc.nextInt());
    }
}
`);
assert.match(r.run.stderr, /java\.util\.NoSuchElementException\n\tat Main\.main\(Main\.java:5\)\n?$/);

// System.exit, and a public class that is not called Main.
r = await java(`public class Solution {
    public static void main(String[] args) {
        System.out.println("a");
        System.exit(0);
        System.out.println("b");
    }
}
`);
assert.equal(r.compile.fileName, 'Solution.java');
assert.equal(r.run.stdout, 'a\n');
assert.equal(r.run.exitCode, 0);

r = await java('public class Main { public static void main(String[] a) { System.exit(3); } }');
assert.equal(r.run.exitCode, 1, 'non-zero exit is a failure');

r = await java('public class Main { static void helper() {} }');
assert.equal(r.compile.ok, false);
assert.match(r.compile.diagnostics[0].message, /No main method/);

console.log('java engine tests passed');
