/**
 * Data arena (C12): pure logic for scoring predictions, shared by the Worker
 * and its tests. No I/O here.
 *
 * A challenge has hidden answers (id, target). A submission is a CSV with the
 * same id and target columns. It is checked row for row, then scored with the
 * challenge's metric. Scores are computed twice: on a "public" slice of the
 * rows (shown while the challenge is open) and on all of them (the final
 * score, shown once an officer closes it), so tuning to the public score does
 * not pay.
 */

export const METRICS = {
  accuracy: { label: 'Accuracy', higherIsBetter: true, kind: 'classification' },
  rmse: { label: 'RMSE', higherIsBetter: false, kind: 'regression' },
  mae: { label: 'MAE', higherIsBetter: false, kind: 'regression' },
};
export const METRIC_IDS = Object.keys(METRICS);

export const MAX_CSV_BYTES = 500_000; // per file, officer upload or member submission
export const MIN_ROWS = 10;
export const MAX_ROWS = 20_000;
export const PUBLIC_PERCENT = 30; // share of rows behind the public score

/** Parses CSV text (quoted fields, "" escapes, CRLF) to an array of string arrays. Blank lines are skipped. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const s = String(text ?? '').replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.length > 1 || row[0] !== '') rows.push(row);
  return rows;
}

/** Strictly numeric ("12", "-3.5", "1e3"); no blanks, no "nan", no "inf". */
export function toNumber(s) {
  const t = String(s ?? '').trim();
  if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** "1" and "1.0" are the same label; anything else compares as trimmed text. */
export const normLabel = (s) => {
  const n = toNumber(s);
  return n === null ? String(s ?? '').trim() : String(n);
};

/**
 * Reads a CSV into `Map(id -> value)` using the named columns.
 * -> { map } or { error: 'Readable sentence.' }. `what` names the file in errors.
 */
export function readColumns(text, idCol, targetCol, what = 'The file') {
  if (typeof text !== 'string' || !text.trim()) return { error: `${what} is empty.` };
  const rows = parseCsv(text);
  if (rows.length < 2) return { error: `${what} needs a header row and at least one data row.` };
  const head = rows[0].map((h) => h.trim());
  const ci = head.indexOf(idCol);
  const ct = head.indexOf(targetCol);
  if (ci < 0 || ct < 0) {
    return { error: `${what} must have the columns "${idCol}" and "${targetCol}". It has: ${head.slice(0, 8).join(', ') || 'none'}.` };
  }
  const map = new Map();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length !== head.length) return { error: `${what}: row ${i + 1} has ${r.length} values but the header has ${head.length}.` };
    const id = r[ci].trim();
    if (!id) return { error: `${what}: row ${i + 1} has no ${idCol}.` };
    if (map.has(id)) return { error: `${what}: the ${idCol} "${id.slice(0, 40)}" appears more than once.` };
    map.set(id, r[ct]);
  }
  return { map };
}

const sample = (ids) => ids.slice(0, 3).map((x) => `"${x.slice(0, 20)}"`).join(', ');

/**
 * Checks a member's predictions against the hidden answers.
 * `answers` is the Map from readColumns on the answers file.
 * -> { preds: Map(id -> number | string) } or { error }.
 */
export function validatePredictions(text, answers, { idCol, targetCol, metric }) {
  const kind = METRICS[metric]?.kind;
  if (!kind) return { error: 'This challenge has an unknown metric.' };
  if (typeof text !== 'string' || text.length > MAX_CSV_BYTES) {
    return { error: `The file is too big. Keep it under ${Math.round(MAX_CSV_BYTES / 1000)} KB.` };
  }
  const { map, error } = readColumns(text, idCol, targetCol, 'Your file');
  if (error) return { error };
  if (map.size !== answers.size) return { error: `Your file has ${map.size} rows but this challenge expects ${answers.size}.` };
  const missing = [...answers.keys()].filter((id) => !map.has(id));
  if (missing.length) return { error: `${missing.length} ${idCol} value${missing.length > 1 ? 's are' : ' is'} missing, for example ${sample(missing)}.` };
  // Equal sizes and nothing missing means nothing extra, so the ids match exactly.

  const labels = kind === 'classification' ? new Set([...answers.values()].map(normLabel)) : null;
  const preds = new Map();
  for (const [id, raw] of map) {
    if (kind === 'regression') {
      const n = toNumber(raw);
      if (n === null) return { error: `The prediction for ${idCol} "${id.slice(0, 20)}" is not a number: "${String(raw).trim().slice(0, 20)}".` };
      preds.set(id, n);
    } else {
      const lab = normLabel(raw);
      if (!labels.has(lab)) {
        return { error: `The label "${lab.slice(0, 20)}" for ${idCol} "${id.slice(0, 20)}" is not one this challenge uses. Labels: ${[...labels].slice(0, 6).join(', ')}.` };
      }
      preds.set(id, lab);
    }
  }
  return { preds };
}

/** Score one metric over parallel arrays. Empty input scores null. */
export function score(metric, predicted, actual) {
  const n = actual.length;
  if (!n || predicted.length !== n) return null;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    if (metric === 'accuracy') sum += normLabel(predicted[i]) === normLabel(actual[i]) ? 1 : 0;
    else if (metric === 'rmse') sum += (predicted[i] - actual[i]) ** 2;
    else if (metric === 'mae') sum += Math.abs(predicted[i] - actual[i]);
    else return null;
  }
  const v = metric === 'accuracy' ? sum / n : metric === 'rmse' ? Math.sqrt(sum / n) : sum / n;
  return Math.round(v * 1e6) / 1e6;
}

/** Stable 32-bit FNV-1a, used to put an id on the public or private side. */
export function hashId(id) {
  let h = 0x811c9dc5;
  for (const ch of String(id)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Is this row part of the public slice? Depends only on the id, so it never changes. */
export const isPublic = (id, challengeId) => hashId(`${challengeId}:${id}`) % 100 < PUBLIC_PERCENT;

/** -> { public, final } scores for validated predictions. `answers` holds raw strings; regression converts here. */
export function scoreSubmission(metric, preds, answers, challengeId) {
  const regression = METRICS[metric].kind === 'regression';
  const pub = { p: [], a: [] };
  const all = { p: [], a: [] };
  for (const [id, raw] of answers) {
    const a = regression ? toNumber(raw) : raw;
    for (const side of isPublic(id, challengeId) ? [pub, all] : [all]) {
      side.p.push(preds.get(id));
      side.a.push(a);
    }
  }
  const final = score(metric, all.p, all.a);
  // A tiny challenge can have an empty public slice; then the public score is the final one.
  return { public: pub.a.length ? score(metric, pub.p, pub.a) : final, final };
}

/** Sorts best first for the metric. `key` picks the score from each row. */
export const rankRows = (rows, metric, key) => {
  const dir = METRICS[metric].higherIsBetter ? -1 : 1;
  return [...rows].sort((x, y) => dir * (key(x) - key(y)) || String(x.name).localeCompare(String(y.name)));
};

/** Officer upload -> { error } or the parsed pieces the Worker stores. Answers must cover the test file exactly. */
export function checkChallengeFiles({ train, test, answers, idCol, targetCol, metric }) {
  if (!METRICS[metric]) return { error: `Metric is one of: ${METRIC_IDS.join(', ')}.` };
  if (!/^[A-Za-z_][A-Za-z0-9_ ]{0,39}$/.test(idCol) || !/^[A-Za-z_][A-Za-z0-9_ ]{0,39}$/.test(targetCol) || idCol === targetCol) {
    return { error: 'Column names are plain words, and the id and target columns must differ.' };
  }
  for (const [what, t] of [['The training file', train], ['The test file', test], ['The answers file', answers]]) {
    if (typeof t !== 'string' || !t.trim()) return { error: `${what} is empty.` };
    if (t.length > MAX_CSV_BYTES) return { error: `${what} is over ${Math.round(MAX_CSV_BYTES / 1000)} KB.` };
  }
  const tr = readColumns(train, idCol, targetCol, 'The training file');
  if (tr.error) return tr;
  const ans = readColumns(answers, idCol, targetCol, 'The answers file');
  if (ans.error) return ans;
  const te = parseCsv(test);
  const teHead = te[0]?.map((h) => h.trim()) ?? [];
  if (!teHead.includes(idCol)) return { error: `The test file must have the column "${idCol}".` };
  if (teHead.includes(targetCol)) return { error: `The test file must not contain "${targetCol}"; that is the answer.` };
  const ids = te.slice(1).map((r) => (r[teHead.indexOf(idCol)] ?? '').trim());
  if (new Set(ids).size !== ids.length || ids.some((x) => !x)) return { error: 'The test file has a blank or repeated id.' };
  if (ids.length < MIN_ROWS || ids.length > MAX_ROWS) return { error: `The test file needs ${MIN_ROWS} to ${MAX_ROWS} rows.` };
  if (ids.length !== ans.map.size || ids.some((id) => !ans.map.has(id))) return { error: 'The answers file must list exactly the ids in the test file.' };
  if (tr.map.size < MIN_ROWS) return { error: `The training file needs at least ${MIN_ROWS} rows.` };
  if (METRICS[metric].kind === 'regression') {
    const bad = [...ans.map].find(([, v]) => toNumber(v) === null);
    if (bad) return { error: `A regression answer is not a number (id "${bad[0].slice(0, 20)}").` };
  } else if (new Set([...ans.map.values()].map(normLabel)).size < 2) return { error: 'A classification challenge needs at least two labels.' };
  return { rows: ids.length, answers: ans.map };
}
