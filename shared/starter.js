/**
 * problems.starter (V3-B): a plain string (legacy, Python) or a JSON object
 * `{ "java": ..., "python": ... }`. One parser so the worker and the officer
 * editor read it the same way.
 */
export function parseStarter(raw) {
  const text = typeof raw === 'string' ? raw : '';
  if (text.trimStart().startsWith('{')) {
    try {
      const o = JSON.parse(text);
      if (o && typeof o === 'object' && (typeof o.java === 'string' || typeof o.python === 'string')) {
        return { java: typeof o.java === 'string' ? o.java : '', python: typeof o.python === 'string' ? o.python : '' };
      }
    } catch {
      /* not JSON after all: a Python starter that happens to open with a brace */
    }
  }
  return { java: '', python: text };
}
