import Image from 'next/image';

// The brand's own "still loading" moment — shown by app/loading.tsx on
// every route transition (and available for any page's own Suspense/loading
// branch that wants it), so this fires far more often than the one-time
// SplashScreen entrance. Designed to be equally at home lasting 100ms or
// several seconds: two independently-orbiting rings in the logo's own navy/
// gold palette sweep around a static copy of the mark — the mark itself
// never spins (a spinning logo reads as broken, not premium), only the
// rings around it do. `logo.png` is already in the browser cache by the
// time this can ever mount: Header renders the exact same image, and
// Header persists across every client-side navigation — only `{children}`
// swaps — so this never triggers its own image fetch.
export function BrandLoader({
  label = 'Loading…',
  size = 'md',
}: {
  label?: string;
  // 'sm' scales the same mark/rings down for tight spaces — a notification
  // dropdown, a chat thread, a dashboard stat panel — where the default
  // 5.5rem mark would overwhelm the surrounding content.
  size?: 'md' | 'sm';
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={size === 'sm' ? 'brand-loader brand-loader--sm' : 'brand-loader'}
    >
      <span className="sr-only">{label}</span>
      <span className="brand-loader__halo" aria-hidden />
      <span className="brand-loader__ring brand-loader__ring--outer" aria-hidden />
      <span className="brand-loader__ring brand-loader__ring--inner" aria-hidden />
      <span className="brand-loader__mark" aria-hidden>
        <Image src="/logo.png" alt="" width={96} height={96} className="h-full w-full object-contain" />
      </span>
    </div>
  );
}
