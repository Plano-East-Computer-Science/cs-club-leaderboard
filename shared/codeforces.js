/**
 * Codeforces helpers (C4), pure so the worker, the browser fallback and the
 * tests share them: handle check, the ownership challenge, turning a
 * user.status list into solved problems, and matching a rung URL to a problem.
 */

export const CHALLENGE = { contestId: 4, index: 'A', name: 'Watermelon', verdict: 'COMPILATION_ERROR', minutes: 15 };
export const CHALLENGE_URL = `https://codeforces.com/problemset/problem/${CHALLENGE.contestId}/${CHALLENGE.index}`;
export const BLOCKED_MSG = 'Codeforces did not answer the club server; your solves will sync later.';
export const GAP_MS = 2000; // Codeforces allows one API request every two seconds
export const MAX_PER_RUN = 20; // handles synced per hourly run
export const STATUS_COUNT = 100;

const HANDLE = /^[A-Za-z0-9_.-]{3,24}$/;
/** A trimmed handle, or '' if it cannot be one. */
export const cleanHandle = (s) => {
  const h = String(s ?? '').trim();
  return HANDLE.test(h) ? h : '';
};

/**
 * Did this member submit the deliberate Compilation Error to 4A after the
 * challenge started and inside its window? `skewSec` forgives clock drift
 * between Codeforces and us.
 */
export function challengeMet(subs, issuedAtMs, { skewSec = 60 } = {}) {
  const from = issuedAtMs / 1000 - skewSec;
  const to = issuedAtMs / 1000 + CHALLENGE.minutes * 60 + skewSec;
  return (Array.isArray(subs) ? subs : []).some(
    (s) =>
      s?.verdict === CHALLENGE.verdict &&
      s.problem?.contestId === CHALLENGE.contestId &&
      s.problem?.index === CHALLENGE.index &&
      s.creationTimeSeconds >= from &&
      s.creationTimeSeconds <= to
  );
}

/**
 * user.status -> unique solved problems [{ contest_id, idx, rating, solved_at }]
 * (earliest accepted submission wins). Gym contests (id >= 100000) are not
 * ladder material and are skipped. Anything malformed is skipped, not thrown:
 * the browser fallback sends data we only checked for shape.
 */
export function solvedFrom(subs, { nowSec = Date.now() / 1000 } = {}) {
  const out = new Map();
  for (const s of Array.isArray(subs) ? subs : []) {
    const p = s?.problem;
    if (s?.verdict !== 'OK' || !p || !Number.isInteger(p.contestId) || p.contestId < 1 || p.contestId >= 100000) continue;
    if (typeof p.index !== 'string' || !/^[A-Z][0-9]?$/.test(p.index)) continue;
    const t = Number(s.creationTimeSeconds);
    if (!Number.isFinite(t) || t <= 0 || t > nowSec + 3600) continue;
    const key = `${p.contestId}${p.index}`;
    const prev = out.get(key);
    if (!prev || t < prev.t) out.set(key, { contest_id: p.contestId, idx: p.index, rating: Number.isInteger(p.rating) ? p.rating : 0, t });
  }
  return [...out.values()].map(({ t, ...r }) => ({ ...r, solved_at: Math.floor(t) }));
}

/** A rung URL -> { contest, idx } when it points at one Codeforces problem. */
export function problemOfUrl(url) {
  const m = String(url ?? '').match(
    /^https:\/\/(?:www\.)?codeforces\.com\/(?:problemset\/problem\/(\d{1,6})\/([A-Z][0-9]?)|contest\/(\d{1,6})\/problem\/([A-Z][0-9]?))\/?(?:[?#].*)?$/
  );
  if (!m) return null;
  return { contest: Number(m[1] ?? m[3]), idx: m[2] ?? m[4] };
}

/** Which of these rungs does the solved set cover? */
export function rungsSolved(rungs, solved) {
  const have = new Set(solved.map((s) => `${s.contest_id}${s.idx}`));
  return rungs.filter((r) => {
    const p = problemOfUrl(r.url);
    return p && have.has(`${p.contest}${p.idx}`);
  });
}

/**
 * A request pacer: `wait()` resolves once `gap` ms have passed since the
 * previous wait finished. Clock and sleep are injected so tests need no timers.
 */
export function makePacer(gap = GAP_MS, now = () => Date.now(), sleep = (ms) => new Promise((r) => setTimeout(r, ms))) {
  let last = -Infinity;
  return async function wait() {
    const d = last + gap - now();
    if (d > 0) await sleep(d);
    last = now();
  };
}
