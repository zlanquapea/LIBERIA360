'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';

const FOCUSABLE =
  "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

// Bottom sheet on phones, centered dialog from sm up. Portalled to <body>
// for the same reason as MobileMenu: Header's backdrop-blur creates a
// containing block that would otherwise trap a fixed overlay.
export function MenuSheet({
  open,
  onClose,
  label,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Read through a ref so a parent passing an inline arrow doesn't re-run
  // the effect below (and yank focus back to the first field) every render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus());

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
      previousFocus?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-slate-950/60 backdrop-blur-[2px] animate-[menu-fade-in_150ms_ease-out] motion-reduce:animate-none"
      />
      <div
        ref={panelRef}
        className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-2xl animate-[menu-sheet-up_220ms_cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:animate-none dark:bg-slate-900 sm:max-h-[88vh] sm:max-w-lg sm:rounded-[2rem]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute end-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-md backdrop-blur transition hover:bg-white dark:bg-slate-800/90 dark:text-slate-200"
        >
          <XMarkIcon aria-hidden className="h-5 w-5" />
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-slate-100 bg-white px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] dark:border-slate-800 dark:bg-slate-900">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
