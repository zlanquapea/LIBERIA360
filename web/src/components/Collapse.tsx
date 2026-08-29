'use client';

// Smooth open/close for a disclosure panel (the admin moderation
// "Read full listing before deciding →" expanders, and anywhere else that
// toggles a block of content) — previously an instant `{open && <div>...}`,
// which pops the whole panel in/out with no transition at all.
//
// Uses the CSS grid "0fr → 1fr" trick rather than measuring pixel height
// with a ResizeObserver: a single-row grid with `grid-template-rows`
// animated between `0fr` and `1fr`, and the actual content wrapped in an
// `overflow-hidden` div, gets a real height transition — including for
// content whose height isn't known up front (a photo grid, a variable-length
// description) — with zero JS and no layout thrash. The `collapse-panel`
// class is a hook for globals.css's `prefers-reduced-motion` guard (a
// plain Tailwind arbitrary-value class isn't a stable CSS selector to
// target from there).
export function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      className="collapse-panel grid transition-[grid-template-rows] duration-300 ease-out"
      style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}
