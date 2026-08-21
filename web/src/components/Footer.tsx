import Link from 'next/link';

// Sits at the bottom of the scrollable content area, above BottomNav's
// sticky tab bar (see app/layout.tsx) — the one place in this mobile-first
// app a visitor can reliably find the legal pages, since there's no
// traditional desktop-style footer elsewhere in the design.
export function Footer() {
  return (
    <footer className="mt-8 border-t border-slate-200 dark:border-slate-800 px-4 py-6 text-center text-xs text-slate-400 dark:text-slate-400">
      <p>© {new Date().getFullYear()} LIBERIA360 — Everything Liberia. One Place.</p>
      <p className="mt-1 flex items-center justify-center gap-3">
        <Link href="/privacy" className="hover:text-slate-600 dark:hover:text-slate-300 hover:underline">
          Privacy Policy
        </Link>
        <Link href="/terms" className="hover:text-slate-600 dark:hover:text-slate-300 hover:underline">
          Terms of Service
        </Link>
      </p>
    </footer>
  );
}
