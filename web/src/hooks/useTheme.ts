'use client';

import { useCallback, useEffect, useState } from 'react';
import { getResolvedTheme, setStoredTheme, subscribeToTheme, type Theme } from '@/lib/theme-storage';

export function useTheme() {
  // Starts 'light' so server-rendered and first-client-render HTML match
  // (localStorage/matchMedia don't exist on the server) — the inline script
  // in layout.tsx already applied the real class to <html> before paint, so
  // this only has to catch up in an effect, same trick as useAuth.
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    function sync() {
      setTheme(getResolvedTheme());
    }
    sync();
    return subscribeToTheme(sync);
  }, []);

  const toggleTheme = useCallback(() => {
    setStoredTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme]);

  return { theme, toggleTheme };
}
