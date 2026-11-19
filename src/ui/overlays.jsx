/**
 * Dialog, Menu and Toast: Radix primitives (focus trap, Escape, roving focus)
 * styled with the v2 tokens. Toasts sit bottom-right for four seconds.
 */
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as RDialog from '@radix-ui/react-dialog';
import * as RMenu from '@radix-ui/react-dropdown-menu';
import { X } from '@phosphor-icons/react';
import { cx } from './primitives.jsx';

/* --------------------------------- Dialog --------------------------------- */

/** Controlled (open/onOpenChange) or uncontrolled with a `trigger`. */
export function Dialog({ open, onOpenChange, trigger, title, description, children, className }) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RDialog.Trigger asChild>{trigger}</RDialog.Trigger>}
      <RDialog.Portal>
        <RDialog.Overlay className="ui-overlay" />
        <RDialog.Content className={cx('ui-dialog', className)}>
          <div className="ui-dialog__h">
            <RDialog.Title className="ui-title">{title}</RDialog.Title>
            <RDialog.Close className="ui-btn ui-btn--ghost ui-btn--icon" aria-label="Close">
              <X size={18} aria-hidden="true" />
            </RDialog.Close>
          </div>
          {description ? (
            <RDialog.Description className="ui-dialog__d">{description}</RDialog.Description>
          ) : (
            <RDialog.Description className="sr-only">{title}</RDialog.Description>
          )}
          {children}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

/* ---------------------------------- Menu ---------------------------------- */

/**
 * items: [{ label, icon, to } | { label, icon, onSelect, danger } | { separator: true } | { heading }].
 */
export function Menu({ trigger, items, align = 'end', label }) {
  return (
    <RMenu.Root modal={false}>
      <RMenu.Trigger asChild>{trigger}</RMenu.Trigger>
      <RMenu.Portal>
        <RMenu.Content className="ui-menu" align={align} sideOffset={8} collisionPadding={12} aria-label={label}>
          {items.map((it, i) => {
            if (it.separator) return <RMenu.Separator key={i} className="ui-menu__sep" />;
            if (it.heading) return <RMenu.Label key={i} className="ui-menu__label">{it.heading}</RMenu.Label>;
            const Icon = it.icon;
            const inner = (
              <>
                {Icon && <Icon size={18} aria-hidden="true" />}
                <span>{it.label}</span>
              </>
            );
            return it.to ? (
              <RMenu.Item key={i} asChild className={cx('ui-menu__item', it.danger && 'ui-menu__item--bad')}>
                <Link to={it.to}>{inner}</Link>
              </RMenu.Item>
            ) : (
              <RMenu.Item key={i} className={cx('ui-menu__item', it.danger && 'ui-menu__item--bad')} onSelect={it.onSelect}>
                {inner}
              </RMenu.Item>
            );
          })}
        </RMenu.Content>
      </RMenu.Portal>
    </RMenu.Root>
  );
}

/* ---------------------------------- Toast ---------------------------------- */

const ToastCtx = createContext(() => {});

/** Wrap the app once; `useToast()` then returns `toast(text, { tone })`. */
export function ToastProvider({ children }) {
  const [list, setList] = useState([]);
  const n = useRef(0);
  const toast = useCallback((text, { tone = 'ok' } = {}) => {
    const id = ++n.current;
    setList((l) => [...l.slice(-2), { id, text, tone }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="ui-toasts" role="status" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className={cx('ui-toast', t.tone === 'bad' && 'ui-toast--bad')}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
