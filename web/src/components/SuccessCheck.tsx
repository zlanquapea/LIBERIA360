// A restrained "this actually worked" moment for a completed action (an
// order placed, a checkout finished) — the checkmark draws itself in and a
// soft halo breathes once behind it, then everything settles. Same
// register as BrandLoader (loading.tsx): nothing spins or bounces, just
// one purposeful motion that completes and stops. Purely decorative — the
// caller still owns its own text and any `role="status"`/`aria-live`
// announcement alongside this; screen readers get nothing extra to skip
// past. `pathLength={1}` on both SVG shapes lets the CSS animate
// `stroke-dashoffset` from 1 to 0 regardless of each path's actual
// geometry — see globals.css's `.success-check__ring`/`__tick`.
export function SuccessCheck({
  className = 'h-8 w-8 text-accent-600 dark:text-accent-400',
}: {
  className?: string;
}) {
  return (
    <span className="success-check">
      <span className="success-check__halo" aria-hidden />
      <svg viewBox="0 0 52 52" className={className} aria-hidden>
        <circle className="success-check__ring" cx="26" cy="26" r="23" pathLength={1} />
        <path className="success-check__tick" d="M15 27l7.5 7.5L37 18" pathLength={1} />
      </svg>
    </span>
  );
}
