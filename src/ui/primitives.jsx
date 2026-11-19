/**
 * Club OS v2 building blocks (docs/v2-design.md "Components"): buttons, pills,
 * cards, stats, page headers, tabs, fields and the empty, error and loading
 * states every screen needs. Styling lives in ui.css under the `ui-` prefix so
 * nothing here collides with the older terminal classes in index.css.
 */
import { forwardRef, useId } from 'react';
import { Link, NavLink } from 'react-router-dom';
import * as RTabs from '@radix-ui/react-tabs';
import * as RTooltip from '@radix-ui/react-tooltip';
import * as RPopover from '@radix-ui/react-popover';
import { WarningCircle, Info } from '@phosphor-icons/react';

const cx = (...c) => c.filter(Boolean).join(' ');
export { cx };

/** Track id -> class that sets --tc. Unknown ids fall back to the neutral explorer colour. */
const TRACK_IDS = ['contest', 'build', 'ai', 'data', 'cyber', 'eng', 'explore'];
const TRACK_ALIAS = { builder: 'build', engineering: 'eng', explorer: 'explore', cp: 'contest', llm: 'ai', projects: 'build', circuits: 'eng' };
export const trackClass = (t) => {
  const id = TRACK_ALIAS[t] ?? t;
  return `tr-${TRACK_IDS.includes(id) ? id : 'explore'}`;
};
export const TRACK_LABEL = { contest: 'Contest', build: 'Build', ai: 'AI', data: 'Data', cyber: 'Cyber', eng: 'Engineering', explore: 'Explore' };

/* --------------------------------- Button --------------------------------- */

/**
 * variant: primary (gold, one per screen), secondary, ghost, danger.
 * Renders a router Link with `to`, an anchor with `href`, else a button.
 * Icon-only buttons must pass `aria-label`.
 */
export const Button = forwardRef(function Button(
  { variant = 'secondary', size, to, href, icon: Icon, iconRight: IconR, children, className, type = 'button', ...rest },
  ref
) {
  const cls = cx('ui-btn', `ui-btn--${variant}`, size && `ui-btn--${size}`, !children && 'ui-btn--icon', className);
  const body = (
    <>
      {Icon && <Icon size={18} aria-hidden="true" />}
      {children != null && <span>{children}</span>}
      {IconR && <IconR size={16} aria-hidden="true" />}
    </>
  );
  if (to) return <Link ref={ref} to={to} className={cls} {...rest}>{body}</Link>;
  if (href) return <a ref={ref} href={href} className={cls} target="_blank" rel="noreferrer noopener" {...rest}>{body}</a>;
  return <button ref={ref} type={type} className={cls} {...rest}>{body}</button>;
});

/* ---------------------------------- Pill ---------------------------------- */

/** tone: neutral, gold, live, need. `track` colours it by track instead. */
export function Pill({ tone = 'neutral', track, icon: Icon, children, className }) {
  return (
    <span className={cx('ui-pill', track ? cx('ui-pill--track', trackClass(track)) : `ui-pill--${tone}`, className)}>
      {Icon && <Icon size={14} aria-hidden="true" />}
      {children}
    </span>
  );
}

export const TrackChip = ({ track }) => <Pill track={track}>{TRACK_LABEL[TRACK_ALIAS[track] ?? track] ?? track}</Pill>;

/* ---------------------------------- Card ---------------------------------- */

/** An object on the page (a problem, a project). `to`/`href` makes the whole card a link that lifts on hover. */
export function Card({ to, href, track, className, children, as: As = 'article', ...rest }) {
  const cls = cx('ui-card', (to || href) && 'ui-card--link', track && cx('ui-card--edge', trackClass(track)), className);
  if (to) return <Link to={to} className={cls} {...rest}>{children}</Link>;
  if (href) return <a href={href} className={cls} target="_blank" rel="noreferrer noopener" {...rest}>{children}</a>;
  return <As className={cls} {...rest}>{children}</As>;
}

/* ---------------------------------- Stat ---------------------------------- */

export function Stat({ value, label, className }) {
  return (
    <div className={cx('ui-stat', className)}>
      <span className="ui-stat__v">{value}</span>
      <span className="ui-stat__l">{label}</span>
    </div>
  );
}

/* ------------------------------- PageHeader ------------------------------- */

/** Display L title, one-line subtitle (15 words max), right-aligned actions. No eyebrow. */
export function PageHeader({ title, subtitle, actions, className }) {
  return (
    <header className={cx('ui-ph', className)}>
      <div className="ui-ph__t">
        <h1 className="ui-display-l">{title}</h1>
        {subtitle && <p className="ui-ph__s">{subtitle}</p>}
      </div>
      {actions && <div className="ui-ph__a">{actions}</div>}
    </header>
  );
}

/** A titled group on a page: sentence-case title, optional action link on the right. */
export function Section({ title, action, children, className, id }) {
  const hid = useId();
  return (
    <section className={cx('ui-sec', className)} aria-labelledby={title ? hid : undefined} id={id}>
      {(title || action) && (
        <div className="ui-sec__h">
          {title && <h2 id={hid} className="ui-title">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/* ---------------------------------- Tabs ---------------------------------- */

/** Underline tabs that switch panels in place. items: [{ value, label, content }]. */
export function Tabs({ items, defaultValue, label, className, listClassName }) {
  return (
    <RTabs.Root className={cx('ui-tabs', className)} defaultValue={defaultValue ?? items[0]?.value}>
      <RTabs.List className={cx('ui-tabs__list', listClassName)} aria-label={label}>
        {items.map((t) => (
          <RTabs.Trigger key={t.value} value={t.value} className={cx('ui-tab', t.className)}>
            {t.label}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
      {items.map((t) => (
        <RTabs.Content key={t.value} value={t.value} className="ui-tabs__panel">
          {t.content}
        </RTabs.Content>
      ))}
    </RTabs.Root>
  );
}

/** Underline tabs that are routes (inside a door). items: [{ to, label, end? }]. */
export function NavTabs({ items, label }) {
  return (
    <div className="ui-navtabs">
      <nav className="ui-tabs__list" aria-label={label}>
        {items.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className="ui-tab">
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/* ---------------------------------- Field ---------------------------------- */

/**
 * Label above, helper and error below. `as` picks input, select or textarea;
 * everything else goes to that control.
 */
export function Field({ label, helper, error, as: As = 'input', className, children, ...rest }) {
  const id = useId();
  const desc = [helper && `${id}-h`, error && `${id}-e`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cx('ui-field', error && 'ui-field--bad', className)}>
      <label htmlFor={id} className="ui-field__l">{label}</label>
      <As id={id} className="ui-input" aria-invalid={error ? true : undefined} aria-describedby={desc} {...rest}>
        {children}
      </As>
      {helper && <p id={`${id}-h`} className="ui-field__h">{helper}</p>}
      {error && <p id={`${id}-e`} className="ui-field__e" role="alert">{error}</p>}
    </div>
  );
}

/* ------------------------- empty, error, loading ------------------------- */

/** Icon, one sentence, one button. */
export function EmptyState({ icon: Icon = Info, children, action, className }) {
  return (
    <div className={cx('ui-empty', className)}>
      <Icon size={24} aria-hidden="true" className="ui-empty__i" />
      <p>{children}</p>
      {action}
    </div>
  );
}

/** Says what went wrong and offers a retry. */
export function ErrorState({ children = 'This did not load.', onRetry, className }) {
  return (
    <div className={cx('ui-empty', 'ui-empty--bad', className)} role="alert">
      <WarningCircle size={24} aria-hidden="true" className="ui-empty__i" />
      <p>{children}</p>
      {onRetry && <Button onClick={onRetry}>Try again</Button>}
    </div>
  );
}

/** Shapes of the real content. kind: line, title, block, circle. */
export function Skeleton({ kind = 'line', className }) {
  return <span className={cx('ui-sk', `ui-sk--${kind}`, className)} aria-hidden="true" />;
}

/** A few skeleton rows standing in for a list, announced once to screen readers. */
export function SkeletonList({ rows = 3, label = 'Loading' }) {
  return (
    <div className="ui-sk-list" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="ui-sk-row">
          <Skeleton kind="circle" />
          <div className="ui-sk-col">
            <Skeleton kind="line" />
            <Skeleton kind="line" className="ui-sk--short" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* --------------------------- Tooltip and Popover --------------------------- */

export function Tip({ label, children, side = 'bottom' }) {
  return (
    <RTooltip.Root delayDuration={300}>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content side={side} sideOffset={6} className="ui-tip">
          {label}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}

/** "How this works": rules live behind a small trigger, never above the first action. */
export function HowItWorks({ label = 'How this works', title, children }) {
  return (
    <RPopover.Root>
      <RPopover.Trigger className="ui-how">
        <Info size={16} aria-hidden="true" />
        {label}
      </RPopover.Trigger>
      <RPopover.Portal>
        <RPopover.Content className="ui-pop" sideOffset={8} align="start" collisionPadding={16}>
          {title && <p className="ui-pop__t">{title}</p>}
          {children}
          <RPopover.Arrow className="ui-pop__arrow" />
        </RPopover.Content>
      </RPopover.Portal>
    </RPopover.Root>
  );
}
