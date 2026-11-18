/**
 * Mission Control v2 primitives. Styles live in src/styles/system.css.
 * See docs/design-direction.md before adding another look-alike.
 */
import { CountUp } from './bits.jsx';
import { initials } from '../lib/format.js';

/** State label. tone: live | gold | warn | (none). */
export function Pill({ tone = '', children }) {
  return (
    <span className={`pill ${tone}`}>
      {tone === 'live' && <i aria-hidden="true" />}
      {children}
    </span>
  );
}

function hueOf(seed = '') {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

/** Rounded-square initials tile, colour fixed by the seed. */
export function Person({ name, seed, size = 36 }) {
  return (
    <span className="person" style={{ '--sz': `${size}px`, '--h': hueOf(seed || name) }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

/** A big number that counts up once, with a plain label. */
export function Stat({ value, label, prefix = '' }) {
  return (
    <div>
      <div className="stat-n">{prefix}<CountUp value={value} /></div>
      <p className="stat-l">{label}</p>
    </div>
  );
}

/** Progress ring. `p` is 0..1; `value`/`label` sit in the middle. */
export function Ring({ p = 0, value, label, size = 132, color }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, p));
  return (
    <div className="ring" style={{ '--sz': `${size}px`, '--c': color }} role="img" aria-label={`${Math.round(pct * 100)} percent`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="ring-tr" cx="50" cy="50" r={r} />
        <circle className="ring-fg" cx="50" cy="50" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <div className="ring-c">
        <b>{value}</b>
        {label && <span>{label}</span>}
      </div>
    </div>
  );
}

/**
 * Horizontal ladder. `stops`: [{ at: 0..1, label }]. `p`: where "you" are, 0..1.
 * Stops at or before `p` render as done.
 */
export function Track({ stops = [], p = 0, me = 'you' }) {
  const pct = `${Math.max(0, Math.min(1, p)) * 100}%`;
  return (
    <div className="rtrack">
      <div className="rtrack-rail">
        <i className="rtrack-fill" style={{ width: pct }} />
        {stops.map((s) => (
          <span key={s.label} className={`rtrack-stop${s.at <= p ? ' done' : ''}`} style={{ left: `${s.at * 100}%` }}>
            <span>{s.label}</span>
          </span>
        ))}
        <span className="rtrack-me" style={{ left: pct }}>{me}</span>
      </div>
    </div>
  );
}

const PAW = String.raw`  .-.   .-.
 (   ) (   )
  '-'   '-'
 .-.  .-.  .-.
(   )(   )(   )
 '-'  '-'  '-'`;

/** Replaces a grey "nothing here" sentence. One line on what goes here, one action. */
export function EmptyState({ title, children, action, flat }) {
  return (
    <div className={`empty-state${flat ? " flat" : ""}`}>
      <pre aria-hidden="true">{PAW}</pre>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
