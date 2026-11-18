/**
 * Key handling for a code textarea: Tab indents four spaces, Esc then Tab
 * leaves the box (otherwise a Tab-indent box is a keyboard trap), and
 * Ctrl+Enter or Cmd+Enter runs. Shared by the data notebook and the workspace.
 */
import { useRef } from 'react';

export function useCodeKeys(value, setValue, onRun) {
  const escaped = useRef(false);
  const onKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onRun?.();
      return;
    }
    if (e.key === 'Escape') {
      escaped.current = true;
      return;
    }
    if (e.key === 'Tab' && !e.shiftKey && !escaped.current) {
      e.preventDefault();
      const t = e.target;
      const { selectionStart: a, selectionEnd: b } = t;
      setValue(value.slice(0, a) + '    ' + value.slice(b));
      requestAnimationFrame(() => t.setSelectionRange(a + 4, a + 4));
    }
    if (e.key !== 'Tab') escaped.current = false;
  };
  return { onKeyDown, onBlur: () => (escaped.current = false) };
}
