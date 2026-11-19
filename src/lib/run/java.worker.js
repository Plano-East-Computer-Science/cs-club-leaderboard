// Compiles and runs student Java in a worker so an infinite loop can be
// terminated. The compiler is self-hosted under /teavm/ (school networks
// block CDNs); see docs/v3c-java-ide.md.
import { createJavaEngine } from './javaEngine.js';

const ready = (async () => {
  // Held in a variable so the bundler leaves it alone: public/teavm is served as-is.
  const runtimeUrl = '/teavm/compiler.wasm-runtime.js';
  const { load } = await import(/* @vite-ignore */ runtimeUrl);
  const bytes = async (name) => {
    const res = await fetch(`/teavm/${name}`);
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    return new Int8Array(await res.arrayBuffer());
  };
  const [compiler, sdk, classlib, deobfuscator] = await Promise.all([
    bytes('compiler.wasm'),
    bytes('compile-classlib-teavm.bin'),
    bytes('runtime-classlib-teavm.bin'),
    bytes('deobfuscator.wasm').catch(() => null),
  ]);
  const engine = await createJavaEngine({ load, files: { compiler, sdk, classlib, deobfuscator } });
  postMessage({ type: 'ready' });
  return engine;
})().catch((e) => {
  // The compiler needs WebAssembly GC and exception references (Chrome and Edge 137+, Firefox 137+).
  const old = e instanceof WebAssembly.CompileError;
  postMessage({ type: 'fatal', message: old ? 'this browser is too old for the Java compiler. Update Chrome, Edge or Firefox.' : String(e?.message || e) });
  return null;
});

// One request at a time, in order: compiling is single-threaded anyway.
let queue = Promise.resolve();
self.onmessage = (ev) => {
  const { id, source, stdins } = ev.data;
  queue = queue.then(async () => {
    const engine = await ready;
    if (!engine) return;
    try {
      const c = await engine.compile(source);
      postMessage({ type: 'compiled', id, ...c });
      if (!c.ok) return;
      for (let i = 0; i < stdins.length; i++) {
        postMessage({ type: 'case', id, index: i, result: await engine.run(stdins[i]) });
      }
    } catch (e) {
      postMessage({ type: 'compiled', id, ok: false, diagnostics: [{ line: null, col: null, severity: 'error', message: `The Java runner failed: ${e?.message || e}` }] });
    }
  });
};
