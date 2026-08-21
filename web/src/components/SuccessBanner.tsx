// Same visual tier as the flag-colored error banners used throughout the
// app (`bg-flag-500/10 text-flag-700`), just the success half — for
// confirming a destructive action actually landed ("Trip deleted
// successfully") rather than only inferring it from the item vanishing
// from a list.
export function SuccessBanner({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
      {children}
    </p>
  );
}
