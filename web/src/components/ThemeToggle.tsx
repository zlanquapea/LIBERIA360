'use client';

import { MoonIcon, SunIcon } from '@heroicons/react/24/outline';
import { useTheme } from '@/hooks/useTheme';

// One button, both icons always in the DOM — swapping the icon based on
// `theme` (rather than rendering conditionally) means there's no
// server/client mismatch to worry about: SSR always renders the same
// markup, and the correct icon is just a CSS class away once the client
// figures out the real theme in its first effect.
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-colors hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700 dark:hover:border-brand-400 dark:hover:bg-slate-800 dark:hover:text-brand-300"
    >
      <SunIcon aria-hidden className={`h-5 w-5 ${theme === 'dark' ? 'hidden' : 'block'}`} />
      <MoonIcon aria-hidden className={`h-5 w-5 ${theme === 'dark' ? 'block' : 'hidden'}`} />
    </button>
  );
}
