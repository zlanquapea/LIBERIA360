import { BrandLoader } from '@/components/BrandLoader';

// Next.js's App Router convention: automatically wraps every route segment
// under app/ in a Suspense boundary and shows this while that segment is
// still being prepared (a server component's data, or a client route's own
// code chunk on navigation) — no per-page wiring needed, so this is the
// "still loading" moment for the whole site, not just one screen. Uses the
// same branded orbiting-rings treatment (BrandLoader) as any page that
// wants its own inline loading state, rather than a generic spinner or a
// content-shaped skeleton — see that component's doc comment for why.
export default function Loading() {
  return (
    <main
      className="page-shell flex min-h-[70vh] flex-col items-center justify-center gap-5"
      aria-busy="true"
      aria-label="Loading LIBERIA360"
    >
      <BrandLoader />
      <p className="text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400">Loading…</p>
    </main>
  );
}
