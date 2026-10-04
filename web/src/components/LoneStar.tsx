// The Lone Star and the flag it flies on, drawn inline so they stay crisp
// at any size and need no image request. Used sparingly as an accent.

export function LoneStar({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <polygon points="12.00,1.10 14.59,9.04 22.94,9.05 16.18,13.96 18.76,21.90 12.00,17.00 5.24,21.90 7.82,13.96 1.06,9.05 9.41,9.04" />
    </svg>
  );
}

/** Liberia's flag at its official 10:19 proportions: eleven red and white
 * stripes and a white star on a blue square. */
export function LiberiaFlag({ className = 'h-4 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 190 100" aria-hidden className={`rounded-[2px] shadow-sm ring-1 ring-black/10 ${className}`}>
      <rect width="190" height="100" fill="#FFFFFF" />
      <rect y="0.00" width="190" height="9.09" fill="#BF0A30" />
      <rect y="18.18" width="190" height="9.09" fill="#BF0A30" />
      <rect y="36.36" width="190" height="9.09" fill="#BF0A30" />
      <rect y="54.55" width="190" height="9.09" fill="#BF0A30" />
      <rect y="72.73" width="190" height="9.09" fill="#BF0A30" />
      <rect y="90.91" width="190" height="9.09" fill="#BF0A30" />
      <rect width="45.45" height="45.45" fill="#002868" />
      <polygon fill="#FFFFFF" points="22.73,6.83 26.43,18.23 38.42,18.23 28.72,25.27 32.43,36.68 22.73,29.63 13.03,36.68 16.74,25.27 7.03,18.23 19.02,18.23" />
    </svg>
  );
}
