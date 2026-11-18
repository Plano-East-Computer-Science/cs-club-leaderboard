# C8 spike: C++ and Java in the browser

Date of research: 2026-11-18. No feature code was written. Each fact is marked **V** (verified:
I read the URL given) or **U** (unverified: from memory, inference, or a page that did not say).

## Short answer

- **C++: prototype first.** A WebAssembly build of Clang 8 plus libc++ and wasm-ld, self-hosted
  under `/clang/`. It runs with no special headers. The catch: `clang.wasm` is 31.2 MB, over the
  25 MiB per-file limit, so it must be split into chunks. Compressed download is about 19 MB.
- **Java: not ready.** CheerpJ is the only mature option, but its free licence loads the runtime
  from a third-party CDN (likely blocked), and self-hosting is paid. TeaVM's in-browser javac is
  self-hostable and small, but `System.in` always throws EOF and `java.util.Scanner` does not
  exist in its class library. Both fail the contest-I/O test as they come.
- Keep route 1 (credit off-site solves through C4) as the main answer for now.

## Platform limits (V)

- Workers static assets: individual file 25 MiB on Free and Paid; 20,000 files per version on
  Free, 100,000 on Paid. Source: https://developers.cloudflare.com/workers/platform/limits/
- Our site today: `wrangler.toml` serves `./dist` as assets. `scripts/copy-pyodide.mjs` already
  fails the build if a file is over 25 MiB. No COOP/COEP headers are set anywhere in `worker/`
  (grep, nothing found).
- Google sign-in is used (`src/pages/SignIn.jsx`, `worker/hub/google.js`). Setting
  `Cross-Origin-Opener-Policy: same-origin` severs `window.opener` and breaks the sign-in popup
  flow, and `Cross-Origin-Embedder-Policy: require-corp` blocks any cross-origin image, font or
  iframe that does not send CORP headers (U: exact effect on our fonts and Google button not
  tested). So any option that needs cross-origin isolation is a real cost here.

## C++ candidates

### A. wasm-clang lineage (Clang 8 + lld + libc++ as wasm32-wasi modules). Recommended

- What it is: Ben Smith's CppCon 2019 demo, "still very much alpha demoware" (V). Repo
  https://github.com/binji/wasm-clang, Apache-2.0 plus LLVM and vasm licences (V), last push
  2023-12-07, no releases, not archived (V, GitHub API).
- A working derivative playground is at https://www2.cs.uh.edu/~panruowu/cpp_playground.html (V).
  It states: compiler, linker and libc++ are all wasm modules; standards c++11, c++14, c++17,
  gnu++17 and c++20 selectable; a "stdin fed to cin" box; time limits 2 to 60 s; no exceptions,
  threads, files or network; stdout capped at 1 MB; first load about 60 MB, cached after. That
  playground fetches its files from the `benagastov/Nim-WASM-Compiler` repo
  (`demo/static/clang/`, no licence declared, pushed 2026-06-15) (V).
- Component sizes, measured by me from that repo (V):

  | file | raw | gzip -9 | brotli q9 |
  |---|---|---|---|
  | clang.wasm | 31,214,472 B | 10.5 MB | 8.5 MB |
  | lld.wasm | 19,490,094 B | 6.7 MB | 5.5 MB |
  | sysroot.tar (libc, libc++ headers and libs) | 9,297,920 B | 1.8 MB | 1.5 MB |
  | memfs.wasm (WASI stdio and in-memory fs) | 345,442 B | 18 KB | 16 KB |

  Total raw 60.3 MB, about 19 MB gzip, about 15.5 MB brotli.
- stdin and stdout: yes. `memfs.wasm` proxies stdio to JS, and the playground feeds a stdin string
  to the program (V, page source). The user program is compiled to a wasm module and run under a
  small WASI host in a worker.
- Language: Clang 8 is 2019. C++17 is mostly there, C++20 is partial (U: the playground only
  offers the flag). `<bits/stdc++.h>` is GCC only, so we would ship a shim header that includes
  the common standard headers. No exceptions in the known build (V, playground page): fine for
  contest code, a compile error for code that uses `try`.
- Licence and self-hosting: LLVM 8 predates the 2019 relicence to Apache-2.0 with LLVM
  exceptions (U), so the binaries are under the old UIUC/NCSA licence plus Apache repo code;
  both allow redistribution (U, confirm LICENSE.llvm before shipping). The Nim-WASM repo has no
  licence of its own, so do not copy from it. Better: take the original binaries (binji's
  GitHub Pages build, or build from https://github.com/binji/llvm-project releases) (U: URLs
  not checked) and pin a sha256.
- Cold start: not stated anywhere (U). Expect 20 MB download plus several seconds to instantiate
  and untar the sysroot. The first compile of a program is probably several seconds (U, measure).
  Run speed is wasm, roughly 1.5 to 3x slower than native (U), which is fine for club problems and
  bad for hard USACO time limits.
- Maintenance: effectively frozen (last push 2023). Acceptable because we pin it; the cost is
  being stuck on Clang 8.
- SharedArrayBuffer: not needed (U, single-threaded modules; the playground says no threads).
  No COOP/COEP.
- Size problem: `clang.wasm` is 31.2 MB which is over 25 MiB (26,214,400 B). Fix: split into
  two chunks of about 16 MiB in the build script (`clang.wasm.0`, `.1`), fetch both and join
  with `new Blob([a, b])` before `WebAssembly.compile`. Alternative: R2 behind a Worker route
  (adds a binding and costs). Chunking is simpler and free. Note the jsDelivr GitHub CDN will not
  serve files that big (V: my fetch of `clang.wasm` through it returned a 49 byte error body), so
  the build must download from another source.

### B. clang.js on npm (`clang.js` / `upclangs.js`)

- Same Ben Smith binaries repackaged. Apache-2.0, 60 MB unpacked, versions 0.1.1 last published
  2023-07-23 (`clang.js`) and 2024-07-16 (`upclangs.js`) (V, `npm view`). Its README loads files
  from jsDelivr by default but supports a local `path` (V, README). Same size and limits as A.
  Useful as a ready JS wrapper to read, but its `run()` API has no obvious stdin option (U).

### C. xeus-cpp-lite (clang-repl compiled to wasm, in JupyterLite)

- Modern Clang, C++20 kernel, stdin works in notebooks (V, project docs and test script via
  search results; https://xeus-cpp.readthedocs.io/). It is a notebook kernel built on
  emscripten-forge packages, so it is a large dependency, not a compile-and-run library. Download
  size not found (U). Bad fit for graded `stdin -> stdout` cases. Not recommended now.

### D. Others

- WebVM / CheerpX (x86 Linux in the browser, could run real g++ and javac): free for personal
  and most non-commercial use (V, https://cheerpx.io/docs/overview). That page says nothing on
  self-hosting, SharedArrayBuffer, or size (U). Third-party loaded and heavy. Skip.
- Playcode and similar hosted playgrounds: third-party, not self-hostable. Skip.
- wasi-sdk with a runtime library (michaelfranzl starter pack, Unlicense, last push 2026-06-07)
  only runs code compiled ahead of time on a developer machine (V). Not a compiler in the
  browser. Skip.
- Piston public API closed February 2026 (V per the roadmap). Judge0 free tier unclear (U).

## Java candidates

### E. CheerpJ (Leaning Technologies)

- What: a JVM in WebAssembly. Docs say current is 5.0, supporting Java 8 (default), 11, 17 and 21,
  Java 25 in preview (V, https://cheerpj.com/docs/ and https://cheerpj.com/docs/faq). Loader:
  `https://cjrtnc.leaningtech.com/5.0/loader.js`, last modified 2026-10-30 (V, HTTP header),
  with CORS and `Cross-Origin-Resource-Policy: cross-origin` headers (V), so it works from a
  page that is not cross-origin isolated.
- Compile and run: CheerpJ runs bytecode. In-browser compiling works by running the real javac
  inside it (JavaFiddle does this) (V, search result from Leaning Technologies material; the
  CheerpJ 2 era, so the CheerpJ 5 recipe is U). That gives full `java.util.Scanner`, the
  complete standard library, and Java 17 or 21 language level.
- stdin: the docs pages I could read do not describe `System.in` handling (U). Needs a prototype.
- Licence (V, https://cheerpj.com/docs/licensing): Community licence is free for personal,
  educational and hobby use, loaded from the CDN, no metering. **Self-hosting is only allowed
  during technical evaluation, as a paid add-on for Small Business, or in Enterprise.** So for
  free use we must load from `cjrtnc.leaningtech.com`.
- Size and cold start: not stated; it fetches runtime parts on demand over HTTP range requests
  and the docs say startup is slower than a local JVM (V, FAQ). A javac boot would likely be
  20 s or more cold (U).
- Maintenance: active (V, loader dated 2026-10-30).
- SharedArrayBuffer and COOP/COEP: the docs do not require them (V that pages say nothing; U that
  none are needed).
- Blocker: a district filter that blocks `leaningtech.com` kills it. The roadmap already says so.
  Test this first (see below).

### F. TeaVM plus javac in a wasm module (`teavm-javac`)

- Repo https://github.com/konsoletyper/teavm-javac: OpenJDK javac and TeaVM compiled together
  into one wasm module. Apache-2.0 for the repo, with OpenJDK parts under GPLv2 plus Classpath
  Exception (V). Last commit 2026-11-09; TeaVM 0.16.0 released 2026-10-02 (V, GitHub API).
  Building needs Java 21 (V).
- Files for the library mode, measured (V, HTTP headers): `compiler.wasm` 4.1 MB,
  `compile-classlib-teavm.bin` 0.2 MB, `runtime-classlib-teavm.bin` 2.4 MB. Total about 6.7 MB
  raw, all well under 25 MiB. Live demo: https://teavm.org/playground.html. Self-hostable on our
  domain. The module is loaded with TeaVM's own wasm runtime, no SharedArrayBuffer stated (U).
- It compiles Java to JavaScript or wasm and runs that, not a real JVM. Java language level for
  user code: not stated (U; built with Java 21 javac).
- **Contest I/O fails as shipped (V, read from the TeaVM source on GitHub):**
  `System.in` is `TConsoleInputStream`, whose `read()` and `read(byte[])` both throw
  `EOFException`. There is no `Scanner` class in `classlib/.../java/util` (no match in the
  repo file tree), while `BufferedReader`, `InputStreamReader`, `StringTokenizer`, `ArrayList`,
  `PriorityQueue` and `TreeMap` do exist. So `new Scanner(System.in)` does not compile, and
  `BufferedReader(new InputStreamReader(System.in))` compiles but reads nothing.
- Fix is real work: add a `Scanner` to the TeaVM classlib or ship a small replacement class that
  the grader rewrites imports to, and make `System.in` read a byte buffer supplied by JS. That
  means building TeaVM ourselves (Java 21 plus Gradle). Doable, not a weekend.

### G. Others

- Doppio, JSweet, Bytecoder, J2CL: either unmaintained or translate source, with no javac in the
  browser (U, not researched in depth).
- A JVM compiled to wasm (for example GraalVM or OpenJDK wasm ports): nothing mature I found
  (U). Not pursued.

## Comparison

| | needs 3rd party | self-host free | download | stdin | std lib | headers |
|---|---|---|---|---|---|---|
| A wasm-clang | no | yes | 60 MB raw, 19 MB gzip | yes (V) | libc++, Clang 8 | none |
| E CheerpJ | yes (CDN) | no (paid) | unstated | U | full JDK | none stated |
| F TeaVM javac | no | yes | 6.7 MB | EOF, no Scanner (V) | partial | none stated |

## Recommendation

Prototype **A (Clang 8 wasm) first**. It is the only candidate that is free, self-hostable, and
already known to read stdin. Java stays on route 1 until a school-network test says CheerpJ is
reachable.

### Integration plan for A (mirrors Pyodide)

1. `scripts/copy-clang.mjs` (new, wired into `prebuild` beside `copy-pyodide.mjs`). Download
   `clang.wasm`, `lld.wasm`, `memfs.wasm`, `sysroot.tar` from a pinned URL, check each against a
   sha256 table kept in the script, write to `public/clang/`. Split `clang.wasm` into
   `clang.wasm.0` and `clang.wasm.1` under 25 MiB each, and reuse the same size guard as
   `copy-pyodide.mjs`. Download only when the file is missing or the hash differs. Keep the
   binaries out of git (add `public/clang` to `.gitignore`, as with `public/pyodide`).
2. `src/lib/cpp.worker.js` (new): load the modules from `/clang/`, hold the memfs and sysroot,
   compile with `clang -std=c++17 -O1`, link with lld, run the result with a WASI host that reads
   the case's stdin and collects stdout and stderr. Compile once per submission and run the
   resulting module once per case.
3. `src/lib/cpprunner.js` (new): copy the shape of `src/lib/pyrunner.js`: a cached worker,
   `warmUp()`, `isReady()`, and `runCases(code, cases, { timeoutMs })` returning
   `[{ ok, stdout, stderr, expected, timedOut }]`, with `reset()` terminating the worker on
   timeout. Add a `compileError` field, because C++ has a compile step Python lacks.
4. `src/lib/py.worker.js` stays as is. UI code that picks a runner (workspace D2, problem pages,
   C12 later) chooses by language: `{ python: pyrunner, cpp: cpprunner }`.
5. Ship a `bits/stdc++.h` shim in the sysroot copy step (a header that includes the usual
   standard headers) so pasted contest code compiles.
6. `test/cpprunner.test.js`: pure-logic checks only (output normalisation, chunk joining,
   sha256 table matches file list). A browser test is out of reach for `npm test`.
7. Prototype measurements to record before building UI: cold download on a throttled link,
   instantiate time, compile time for a 50 line program, run time for a loop of 10^8, and memory
   use. Reject if cold start is over about 30 s on school wifi.

### Open questions to settle in the prototype

- Does a wasm module this big compile in a worker on a school Chromebook? (U: Chromebooks have
  as little as 4 GB RAM; memory use of Clang 8 wasm is not documented.)
- Does the Workers asset layer serve `.wasm` with `Content-Encoding: br`? It usually does, but
  verify with a deployed preview, not local.
- Exact licence text of the binaries we pin.

### Before building Java

1. On a school machine, open `https://cjrtnc.leaningtech.com/5.0/loader.js`. If it loads, a
   CheerpJ prototype is cheap and the licence is fine for educational use. If it is blocked,
   CheerpJ is dead for us.
2. If blocked, the only free self-hosted path is TeaVM with a Scanner and stdin patch, sized L.
   Decide with officers whether Java solves are worth that. Many UIL Java problems only need
   `Scanner` and basic collections, so the patch has to cover those two.

### What to tell members meanwhile

- Python runs on the site today. For C++ and Java, write and test on your own computer or an
  online judge, then link your Codeforces handle (C4) so solves of C++ and Java problems count.
- USACO and UIL practice in C++ or Java: submit on the real contest sites. The club will add an
  in-browser C++ runner if the prototype works on school wifi, and we will say so on the gateway
  page when it does.

## Sources read

- https://developers.cloudflare.com/workers/platform/limits/
- https://cheerpj.com/docs/, https://cheerpj.com/docs/faq, https://cheerpj.com/docs/licensing
- https://cheerpx.io/docs/overview
- https://github.com/konsoletyper/teavm-javac (README, GitHub API metadata) and the TeaVM
  classlib files `TSystem.java` and `TConsoleInputStream.java` in https://github.com/konsoletyper/teavm
- https://teavm.org/playground/compiler.wasm and the two classlib `.bin` files (HTTP headers)
- https://github.com/binji/wasm-clang, https://www2.cs.uh.edu/~panruowu/cpp_playground.html (page
  source), `benagastov/Nim-WASM-Compiler` `demo/static/clang/` (files downloaded and measured)
- `npm view clang.js`, `npm view upclangs.js`
- https://github.com/michaelfranzl/clang-wasm-browser-starterpack
- https://xeus-cpp.readthedocs.io/ (via search results only)
