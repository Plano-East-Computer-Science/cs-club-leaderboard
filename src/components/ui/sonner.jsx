import { Toaster as Sonner } from 'sonner';

/** Site-styled toasts. Theme follows the OS, same as the rest of the page. */
export function Toaster(props) {
  return (
    <Sonner
      theme="system"
      position="bottom-right"
      toastOptions={{
        classNames: { toast: 'mono text-sm' },
        style: {
          background: 'var(--card)',
          color: 'var(--ink)',
          border: '1px solid var(--rule)',
          borderRadius: 'var(--radius)',
        },
      }}
      {...props}
    />
  );
}
