/**
 * Mock contest rules (B5): teams of up to three, a shared problem set, ICPC
 * scoring, a scoreboard that freezes for the last minutes, and the host-driven
 * "unfreeze one team at a time from the bottom" reveal. Pure functions over a
 * plain state object, so test/contest.test.js checks them without a runtime;
 * the room's Durable Object (worker/hub/room-do.js) holds the state and clock.
 *
 *   contest { phase: 'setup' | 'live' | 'ended', problems: [{ slug, title }],
 *             minutes, freeze, penalty, teams: [{ id, name, members: [uid] }],
 *             subs: [{ team, slug, ms, ok, uid }], startedAt, endsAt, revealed: [teamId], nextTeam }
 *
 * Judging is in the browser (Pyodide), the same honour system as duels: the
 * client says whether the tests passed and the server only checks who may
 * submit, for which problem, and when (with its own clock). The server keeps
 * every attempt and its code for officer spot-checks. There is no server judge.
 *
 * Scoring (ICPC): rank by problems solved, then total penalty. A solved
 * problem costs its solve time in whole minutes plus `penalty` minutes per
 * wrong attempt before it. Wrong attempts on a problem never solved cost
 * nothing. Teams level on both share a place.
 */

export const TEAM_SIZE = 3;
export const MIN_PROBLEMS = 3;
export const MAX_PROBLEMS = 8;
const MAX_TEAMS = 40;
const MAX_TRIES = 60; // per team per problem; stops a stuck button from flooding the log

const toInt = (v, d) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : d;
};

/** problems: [{ slug, title }] already checked against the bank. */
export function newContest({ problems, minutes = 30, freeze = 10, penalty = 20 } = {}) {
  const seen = new Set();
  const list = (Array.isArray(problems) ? problems : []).filter((p) => p?.slug && !seen.has(p.slug) && seen.add(p.slug));
  if (list.length < MIN_PROBLEMS || list.length > MAX_PROBLEMS) return { error: `Pick ${MIN_PROBLEMS} to ${MAX_PROBLEMS} problems.` };
  const m = toInt(minutes, 0);
  const f = toInt(freeze, -1);
  const p = toInt(penalty, -1);
  if (!(m >= 1 && m <= 180)) return { error: 'A contest lasts 1 to 180 minutes.' };
  if (!(f >= 0 && f < m)) return { error: 'The freeze must be shorter than the contest.' };
  if (!(p >= 0 && p <= 120)) return { error: 'Penalty is 0 to 120 minutes per wrong attempt.' };
  return {
    contest: {
      phase: 'setup',
      problems: list.map((x) => ({ slug: String(x.slug), title: String(x.title ?? x.slug) })),
      minutes: m,
      freeze: f,
      penalty: p,
      teams: [],
      subs: [],
      startedAt: 0,
      endsAt: 0,
      revealed: [],
      nextTeam: 1,
    },
  };
}

/* ---------------------------------- teams ---------------------------------- */

function shuffled(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Splits people into ceil(n / 3) teams of at most three, as even as possible.
 * 'mixed' deals strongest to weakest in a snake (1..k, k..1) so every team
 * gets a strong member and a newer one; levels: uid -> number (higher is
 * stronger). 'random' is a shuffled deal. Returns arrays of uids.
 */
export function dealTeams(ids, { mode = 'random', levels = {}, rng = Math.random } = {}) {
  const people = [...new Set(ids.map(String))];
  if (!people.length) return [];
  const k = Math.ceil(people.length / TEAM_SIZE);
  const order = shuffled(people, rng); // shuffle first so equal levels break differently each time
  if (mode === 'mixed') order.sort((a, b) => (levels[b] ?? 0) - (levels[a] ?? 0));
  const teams = Array.from({ length: k }, () => []);
  order.forEach((uid, j) => {
    const round = Math.floor(j / k);
    const pos = j % k;
    teams[round % 2 === 0 ? pos : k - 1 - pos].push(uid);
  });
  return teams;
}

export const teamOf = (c, uid) => c.teams.find((t) => t.members.includes(String(uid))) ?? null;

/** Replaces every team (before the start). groups: arrays of uids. */
export function setTeams(c, groups) {
  if (c.phase !== 'setup') return { error: 'Teams are locked once the contest starts. Move people one at a time instead.' };
  c.teams = [];
  c.nextTeam = 1;
  for (const g of groups) if (g.length) c.teams.push({ id: c.nextTeam++, name: `Team ${c.nextTeam - 1}`, members: g.map(String).slice(0, TEAM_SIZE) });
  return { ok: true };
}

/**
 * The host moves one person: to a team id, to a brand new team ('new'), or
 * out of teams (null). Allowed until the contest ends, so a late arrival can
 * be added. A team keeps its results when its members change.
 */
export function moveMember(c, uid, to) {
  if (c.phase === 'ended') return { error: 'The contest is over.' };
  const u = String(uid);
  const from = teamOf(c, u);
  let dest = null;
  if (to === 'new') {
    if (c.teams.length >= MAX_TEAMS) return { error: 'That is a lot of teams.' };
  } else if (to != null) {
    dest = c.teams.find((t) => t.id === Number(to));
    if (!dest) return { error: 'No such team.' };
    if (dest === from) return { ok: true };
    if (dest.members.length >= TEAM_SIZE) return { error: 'That team already has three.' };
  }
  if (from) from.members = from.members.filter((m) => m !== u);
  if (to === 'new') c.teams.push({ id: c.nextTeam++, name: `Team ${c.nextTeam - 1}`, members: [u] });
  else if (dest) dest.members.push(u);
  // An emptied team with nothing submitted is just clutter.
  c.teams = c.teams.filter((t) => t.members.length || c.subs.some((s) => s.team === t.id));
  return { ok: true };
}

/* ------------------------------- the clock -------------------------------- */

export function startContest(c, now) {
  if (c.phase !== 'setup') return { error: 'The contest already started.' };
  c.teams = c.teams.filter((t) => t.members.length);
  if (!c.teams.length) return { error: 'Make teams first.' };
  Object.assign(c, { phase: 'live', startedAt: now, endsAt: now + c.minutes * 60_000 });
  return { ok: true };
}

export function endContest(c) {
  if (c.phase !== 'live') return { error: 'The contest is not running.' };
  c.phase = 'ended';
  return { ok: true };
}

/** When the scoreboard froze (or will), or null when this contest has no freeze. */
export const freezeAt = (c) => (c.freeze > 0 && c.startedAt ? c.endsAt - c.freeze * 60_000 : null);

/** The next moment the room must wake up and re-send state: the freeze, then the end. */
export function nextDue(c, now) {
  if (c?.phase !== 'live') return null;
  const f = freezeAt(c);
  return f != null && f > now ? f : c.endsAt;
}

/* ------------------------------- submissions ------------------------------- */

/**
 * Records one judged attempt for the submitter's team. `team`, when sent, must
 * be the submitter's own team: nobody can submit for a team they are not in.
 * Refused outside the clock, for a problem not in the set, and once the team
 * has already solved it.
 */
export function submit(c, uid, { team, slug, passed }, now) {
  if (c.phase === 'setup') return { error: 'The contest has not started.' };
  if (c.phase !== 'live' || now >= c.endsAt) return { error: 'The contest is over.' };
  const mine = teamOf(c, uid);
  if (!mine) return { error: 'You are not on a team. Ask an officer to add you.' };
  if (team != null && Number(team) !== mine.id) return { error: 'You are not on that team.' };
  if (!c.problems.some((p) => p.slug === slug)) return { error: 'That problem is not in this contest.' };
  const own = c.subs.filter((s) => s.team === mine.id && s.slug === slug);
  if (own.some((s) => s.ok)) return { error: 'Your team already solved that one.' };
  if (own.length >= MAX_TRIES) return { error: 'That is plenty of tries on one problem. Ask a teammate to look.' };
  c.subs.push({ team: mine.id, slug, ms: now - c.startedAt, ok: passed === true, uid: String(uid) });
  return { ok: true, solved: passed === true, team: mine.id };
}

/* -------------------------------- scoring --------------------------------- */

/**
 * Every team's row as of `upTo` ms into the contest (default: everything).
 * row: { id, name, solved, penalty, cells: [{ slug, ok, wrong, ms }] } where
 * `wrong` counts attempts before the solve (or all of them, if unsolved).
 */
export function scoreRows(c, upTo = Infinity) {
  return c.teams.map((t) => {
    const cells = c.problems.map((p) => {
      let wrong = 0;
      let ms = null;
      for (const s of c.subs) {
        if (s.team !== t.id || s.slug !== p.slug || s.ms > upTo) continue;
        if (s.ok) {
          ms = s.ms;
          break;
        }
        wrong++;
      }
      return { slug: p.slug, ok: ms != null, wrong, ms };
    });
    const done = cells.filter((x) => x.ok);
    return {
      id: t.id,
      name: t.name,
      solved: done.length,
      penalty: done.reduce((sum, x) => sum + Math.floor(x.ms / 60_000) + x.wrong * c.penalty, 0),
      cells,
    };
  });
}

const better = (a, b) => a.solved > b.solved || (a.solved === b.solved && a.penalty < b.penalty);

/** Sorts rows best first and gives each a place; ties share one (1, 1, 3). Team id breaks display order only. */
export function rank(rows) {
  return [...rows]
    .sort((a, b) => b.solved - a.solved || a.penalty - b.penalty || a.id - b.id)
    .map((r, _, all) => ({ ...r, place: 1 + all.filter((o) => better(o, r)).length }));
}

/** Teams in the order the reveal unfreezes them: worst final standing first. */
export const revealOrder = (c) => rank(scoreRows(c)).reverse().map((r) => r.id);

export const nextReveal = (c) => revealOrder(c).find((id) => !c.revealed.includes(id)) ?? null;

/** Host unfreezes the next team from the bottom. Only after the end, and only if there was a freeze. */
export function revealNext(c) {
  if (c.phase !== 'ended') return { error: 'Reveal after the contest ends.' };
  if (!(c.freeze > 0)) return { error: 'There was no freeze, so the board is already final.' };
  const id = nextReveal(c);
  if (id == null) return { error: 'Every team is already revealed.' };
  c.revealed.push(id);
  return { ok: true, team: id };
}

/**
 * What the projector and every other member screen shows.
 *   live, before the freeze  the live standings
 *   live, frozen             the standings as of the freeze moment
 *   ended, mid-reveal        revealed teams at their final row, the rest still frozen
 *   ended, all revealed      the final standings
 * Returns { rows (ranked), frozen, final }.
 */
export function publicBoard(c, now) {
  const f = freezeAt(c);
  if (c.phase === 'setup') return { rows: rank(scoreRows(c)), frozen: false, final: false };
  if (c.phase === 'live') {
    const frozen = f != null && now >= f;
    return { rows: rank(scoreRows(c, frozen ? f - c.startedAt : Infinity)), frozen, final: false };
  }
  if (f == null) return { rows: rank(scoreRows(c)), frozen: false, final: true };
  const before = scoreRows(c, f - c.startedAt);
  const after = scoreRows(c);
  const rows = rank(before.map((r, i) => (c.revealed.includes(r.id) ? after[i] : r)));
  const final = c.teams.every((t) => c.revealed.includes(t.id));
  return { rows, frozen: !final, final };
}

/** A team's own live result, with its place among everyone's live results. */
export function ownRow(c, teamId) {
  return rank(scoreRows(c)).find((r) => r.id === teamId) ?? null;
}
