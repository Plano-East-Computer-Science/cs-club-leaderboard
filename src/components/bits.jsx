/**
 * Small shared pieces: avatars, tier marks, badge chips, and the count-up
 * number used on the standings sheet.
 */
import { useEffect, useRef, useState } from 'react';
import { initials } from '../lib/format.js';
import { tierFor, nextTier, tierProgress } from '../lib/tiers.js';

/* ------------------------------- avatar ------------------------------- */

/** Deterministic hue from a name, so a member always looks the same. */
function hueOf(seed = '') {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

export function Avatar({ name, seed, size = 40, points = 0, ring = true }) {
  const hue = hueOf(seed || name || '');
  const tier = tierFor(points);
  return (
    <div
      className="relative shrink-0 grid place-items-center rounded-full font-semibold select-none"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        fontFamily: 'var(--font-mono)',
        background: `hsl(${hue} 46% 92%)`,
        color: `hsl(${hue} 55% 28%)`,
        boxShadow: ring ? `0 0 0 2px var(--card), 0 0 0 3.5px ${tier.color}` : undefined,
      }}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}

/* -------------------------------- tier -------------------------------- */

export function TierMark({ points, showPoints = false, size = 'sm' }) {
  const tier = tierFor(points);
  const pad = size === 'lg' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[0.6875rem]';
  return (
    <span
      className={`mono inline-flex items-center gap-1.5 rounded-full font-semibold tracking-wide ${pad}`}
      style={{
        color: tier.color,
        background: `color-mix(in srgb, ${tier.color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${tier.color} 28%, transparent)`,
      }}
    >
      <span
        className="inline-block rounded-full"
        style={{ width: 6, height: 6, background: tier.color }}
      />
      {tier.name}
      {showPoints && <span style={{ opacity: 0.7 }}>· {points}</span>}
    </span>
  );
}

/** Progress toward the next tier. The reason 11th place still has a target. */
export function TierProgress({ points, className = '' }) {
  const tier = tierFor(points);
  const next = nextTier(points);
  const pct = tierProgress(points) * 100;

  return (
    <div className={className}>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: 'color-mix(in srgb, var(--ink) 8%, transparent)' }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%`, background: tier.color }}
        />
      </div>
      <p className="mono mt-1.5 text-[0.6875rem]" style={{ color: 'var(--ink-faint)' }}>
        {next ? (
          <>
            <span style={{ color: 'var(--ink-soft)', fontWeight: 600 }}>
              {next.min - points} more
            </span>{' '}
            to {next.name}
          </>
        ) : (
          'Top tier reached'
        )}
      </p>
    </div>
  );
}

/* ------------------------------- badges ------------------------------- */

const BADGE_COLORS = {
  amber: '#b8720e', emerald: '#2f8f5b', violet: '#6e3bd1', sky: '#2b5fd9',
  rose: '#c42e2e', orange: '#c2560f', teal: '#128c93', lime: '#4d7c0f',
};

export function BadgeChip({ badge, size = 'sm' }) {
  const color = BADGE_COLORS[badge.color] ?? '#6b7689';
  const pad = size === 'lg' ? 'px-2.5 py-1 text-xs' : 'px-1.5 py-0.5 text-[0.6875rem]';
  return (
    <span
      className={`mono inline-flex items-center gap-1 rounded font-medium ${pad}`}
      style={{
        color,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 24%, transparent)`,
      }}
      title={badge.description || badge.name}
    >
      <span aria-hidden="true">{badge.emoji}</span>
      {badge.name}
    </span>
  );
}

/* ------------------------------ count-up ------------------------------ */

/**
 * Counts a number up on first paint.
 *
 * Starts showing the real value and only drops to zero once the first animation
 * frame actually arrives. requestAnimationFrame does not fire in a hidden or
 * background tab, and a leaderboard that reads "0 points" until you happen to
 * look at it is far worse than one that simply does not animate.
 */
export function CountUp({ value, duration = 900, className = '', style }) {
  const [shown, setShown] = useState(value);
  const frame = useRef(0);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(value);
      return;
    }
    let start = null;
    const tick = (now) => {
      start ??= now;
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic: fast start, gentle landing
      setShown(Math.round(value * (1 - (1 - t) ** 3)));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [value, duration]);

  return (
    <span className={className} style={style}>
      {shown}
    </span>
  );
}

/* ------------------------------ feedback ------------------------------ */

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16" style={{ color: 'var(--ink-faint)' }}>
      <span
        className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current"
        style={{ borderTopColor: 'transparent' }}
      />
      <span className="mono text-xs">{label}</span>
    </div>
  );
}

export function ErrorNote({ children, onRetry }) {
  return (
    <div
      className="card flex flex-wrap items-center gap-3 p-4"
      style={{ borderColor: 'color-mix(in srgb, #c42e2e 35%, transparent)' }}
    >
      <p className="text-sm" style={{ color: '#c42e2e' }}>
        {children}
      </p>
      {onRetry && (
        <button className="btn btn-ghost" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="card p-10 text-center">
      <p className="display text-lg font-semibold">{title}</p>
      {children && (
        <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: 'var(--ink-soft)' }}>
          {children}
        </p>
      )}
    </div>
  );
}
