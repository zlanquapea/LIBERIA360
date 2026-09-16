import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  // Class-based, not `media` — a user's explicit choice (stored via
  // lib/theme-storage.ts) has to win over the OS setting, and the toggle
  // needs to actually do something regardless of prefers-color-scheme.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Palette sampled directly from public/logo.png (the LIBERIA360
        // mark — refreshed Sep 2026 to a sunset pin over a coastline).
        // Teal, from the palm-tree/headland silhouette, is now the
        // dominant color (hue ~192° across a histogram of the artwork's
        // opaque pixels, not eyeballed) so it's the primary/interactive
        // color — links, nav, buttons — same principle the previous navy-
        // based version of this palette used, just resampled for the new
        // mark. `accent` (green) is a separate, deliberately logo-
        // independent "nature" tone (see its own comment below); `gold`
        // and `flag` are the sun and Liberian-flag-red details in the
        // mark, used sparingly as accents, not for functional states (red
        // already means "error" in UI convention) — `gold` in particular
        // already sat almost exactly on this new logo's own sun/arc color
        // too (gold-500 #fbb308 vs. a sampled #fec00d — hue 42° vs. 45°,
        // lightness 51% vs. 52%), so it didn't need to change.
        // Built as an 11-stop HSL ramp at that one hue rather than picked
        // per-shade by eye — but NOT a naive lightness curve: `brand` is
        // used everywhere, not just as a nav background, including as
        // *text* at 500/600/700 (button/link/focus-ring colors app-wide)
        // and inline SVG icons, so every stop was pushed materially darker
        // than a "same lightness steps as the old navy scale" swap would
        // give. Cyan-family hues read far lighter than navy at the same
        // HSL lightness (the G and B channels both carry real luminance
        // weight, unlike navy's blue-dominant, low-luminance mix), so a
        // straight port of the old curve left brand-500 at only 2.4:1
        // against white — failing even the 3:1 non-text floor for the
        // focus rings and borders that shade is used for everywhere, let
        // alone the 4.5:1 text floor for the handful of places it's used
        // as text (e.g. EventTicketScanner's "Scanning Complete" label).
        // Re-tuned so 500 itself clears text contrast, not just non-text:
        // 500 on white 4.95:1 (also 4.6:1 on brand-50, the tinted-card case
        // above actually uses), 600 on white 6.7:1, 700 on white 9.0:1,
        // 300 on slate-900 10.4:1, 400 on the dark surface-canvas 8.3:1 —
        // covering every real text/icon/focus-ring pairing already in the
        // codebase, not just the nav's own prior contrast checks (still
        // true here too: white on 900 14.3:1, blended white/65%-on-900
        // 6.8:1, gold-400 on 900 9.1:1).
        brand: {
          50: '#eff8fa',
          100: '#d9f1f7',
          200: '#a3e4f5',
          300: '#51d5f6',
          400: '#06b8e5',
          500: '#007a99',
          600: '#00647d',
          700: '#005063',
          800: '#003f4f',
          900: '#002f3b',
          950: '#001f26',
        },
        accent: {
          50: '#f1faed',
          100: '#ddf2d3',
          200: '#bfe6ae',
          300: '#8ed177',
          400: '#5fbb42',
          500: '#3aa01e',
          600: '#2b8a12',
          700: '#237610',
          800: '#1c5c0c',
          900: '#123f08',
        },
        gold: {
          // 50/300/950 added alongside the same audit as `brand.950` above —
          // `bg-gold-50`, `text-gold-300`, and `dark:bg-gold-950` were
          // already used (account/page.tsx's featured-listing card) as if
          // they existed; none of them did, so that card's tint silently
          // never rendered in either theme.
          50: '#fef6e3',
          // 100/200/700/800/900 added after a follow-up audit found the
          // same "used as if it existed, never defined" bug still live in
          // five more places — PlaceCard's rating badge (`bg-gold-100`/
          // `text-gold-800`/`dark:bg-gold-900`, rendered on every place
          // card app-wide), NearMeClient's callout (`text-gold-900`/
          // `text-gold-800`, `dark:border-gold-700`), and the admin
          // layout's Super Admin badge (`text-gold-700` in light mode).
          // Interpolated between the existing anchors (50->300 for
          // 100/200, 600->950 for 700/800/900) rather than picked by eye,
          // and contrast-checked against the exact surfaces above:
          // gold-800-on-gold-100 6.0:1, gold-900-on-gold-50 10.4:1,
          // gold-800-on-gold-50 6.5:1, gold-700-on-gold-50 4.8:1 — all
          // clear WCAG AA's 4.5:1 floor for the small/bold text each is
          // actually used as.
          100: '#feedc5',
          200: '#ffe5a8',
          300: '#ffdc8a',
          400: '#ffc63d',
          500: '#fbb308',
          600: '#d99400',
          700: '#936401',
          800: '#795201',
          900: '#513602',
          950: '#2b1c02',
        },
        // Full LIBERIA360 logo palette for the responsive product UI. Keep
        // semantic states on the existing `flag` scale; these named tokens
        // are for brand expression, category accents, and editorial
        // framing. Currently unused by any component (grep before reaching
        // for these) — `navy`/`royal` kept in sync with `brand-900`/`500`
        // regardless, so they're correct the day something does.
        liberia: {
          navy: '#002f3b',
          royal: '#007a99',
          sky: '#2896c8',
          red: '#e21f22',
          green: '#3aa01e',
          forest: '#1e633c',
          lime: '#8ed177',
          gold: '#ffc63d',
          orange: '#f6a800',
          charcoal: '#0f172a',
          mist: '#f6f9fc',
        },
        flag: {
          // Light tints, same hue as 500-700 below, added for dark-mode
          // text/icons — 700 (the shade used for nearly all error/danger
          // text) computes to ~2:1 contrast against the dark-mode page
          // background, well under WCAG AA's 4.5:1 floor for text, so it
          // needs a genuinely light tint here rather than reusing a base
          // shade. 300 is what error text/links switch to via `dark:`;
          // 400 is available for icons/accents that don't need quite as
          // much lift (icons only need to clear the looser 3:1 non-text
          // threshold).
          // 50/200/800 added alongside the same audit as `brand.950` above —
          // `bg-flag-50`, `border-flag-200`, and `dark:border-flag-800` were
          // already used (security-shared.tsx, AccountSecurity.tsx,
          // BusinessClaimSection.tsx) as if they existed; none of them did.
          50: '#fdeeee',
          200: '#f3bcbd',
          300: '#e9aaab',
          400: '#e57678',
          500: '#e21f22',
          600: '#c80305',
          700: '#a10204',
          800: '#7a0103',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        // Headings only — a distinct display face so the app reads as a
        // considered tourism product rather than default system chrome.
        // Loaded via next/font/google in layout.tsx, which self-hosts the
        // font file at build time (no runtime request to Google, no
        // layout-shift flash) — worth caring about on the mobile data
        // budgets this app is built for.
        display: ['var(--font-display)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        // A softer, more "premium travel app" card shadow than Tailwind's
        // default `shadow-md` — wider spread, lower opacity, tinted toward
        // the brand color instead of pure black.
        card: '0 2px 8px -2px rgba(0, 47, 59, 0.08), 0 8px 24px -6px rgba(0, 47, 59, 0.10)',
        'card-hover': '0 4px 14px -2px rgba(0, 47, 59, 0.12), 0 16px 32px -8px rgba(0, 47, 59, 0.16)',
      },
      keyframes: {
        // Small, CSS-only motion vocabulary — deliberately not pulling in
        // a JS animation library for a handful of entrance/hover effects.
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        // The indeterminate loading bar on the first-load splash screen
        // (see components/SplashScreen.tsx) — a short bar sliding across a
        // track, standing in for real progress since there's nothing
        // meaningful to measure (it hides on a fixed minimum-visible
        // timer, not on any actual load event).
        splashBar: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(300%)' },
        },
        // A brief "overshoot" pop for a toggle that just turned on (Save,
        // Interested/Going, Like) — plays once on mount, since the outline
        // icon and the solid icon are two different elements, so React
        // swapping one in for the other is itself the animation trigger;
        // no JS needed to detect the edge.
        pop: {
          '0%': { transform: 'scale(0.6)' },
          '65%': { transform: 'scale(1.25)' },
          '100%': { transform: 'scale(1)' },
        },
        // Homepage hero background (Sep 2026 "wow the arrival" pass): three
        // real photos take turns, each fading in, holding with a slow
        // Ken-Burns zoom, then fading out while the next one's already
        // creeping in underneath. One shared keyframe per layer, offset via
        // a *negative* animation-delay (see page.tsx) so the three layers
        // interleave instead of all animating in lockstep — a much slower,
        // more cinematic cadence than the rejected `float` "breathing"
        // effect (3.5s, fast, infinite up/down) this is deliberately
        // nothing like.
        heroKenBurns: {
          '0%, 100%': { opacity: '0', transform: 'scale(1)' },
          '8%': { opacity: '1', transform: 'scale(1.04)' },
          '33%': { opacity: '1', transform: 'scale(1.12)' },
          '41%': { opacity: '0', transform: 'scale(1.16)' },
        },
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.5s ease-out both',
        'fade-in': 'fadeIn 0.6s ease-out both',
        float: 'float 3.5s ease-in-out infinite',
        'splash-bar': 'splashBar 1.1s ease-in-out infinite',
        pop: 'pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'hero-ken-burns': 'heroKenBurns 24s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
