"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getResolvedTheme,
  getStoredTheme,
  applyTheme,
  setStoredTheme,
  subscribeToTheme,
  type Theme,
} from "@/lib/theme-storage";

export function useTheme() {
  // Starts 'system' so server-rendered and first-client-render HTML match
  // (localStorage/matchMedia don't exist on the server) — the inline script
  // in layout.tsx already applied the real class to <html> before paint, so
  // this only has to catch up in an effect, same trick as useAuth.
  const [theme, setTheme] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    function sync() {
      const choice = getStoredTheme() ?? "system";
      setTheme(choice);
      applyTheme(choice);
      setResolvedTheme(getResolvedTheme());
    }
    sync();
    const unsubscribe = subscribeToTheme(sync);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", sync);
    return () => {
      unsubscribe();
      media.removeEventListener("change", sync);
    };
  }, []);

  const setThemeChoice = useCallback((choice: Theme) => {
    setStoredTheme(choice);
  }, []);

  const toggleTheme = useCallback(() => {
    setStoredTheme(
      theme === "system" ? "light" : theme === "light" ? "dark" : "system",
    );
  }, [theme]);

  return { theme, resolvedTheme, setTheme: setThemeChoice, toggleTheme };
}
