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
        // mark). Navy is the dominant color (the wordmark, capitol
        // silhouette, and arc) so it's the primary/interactive color —
        // links, nav, buttons. `accent` (green) comes from the palm tree /
        // waterfall / "O" and is used for imagery placeholders and the
        // occasional CTA where a warmer, more "nature" tone reads better
        // than navy. `gold` and `flag` are the sun and Liberian-flag-red
        // details in the mark — used sparingly as accents, not for
        // functional states (red already means "error" in UI convention).
        brand: {
          50: '#f1f3fa',
          100: '#dfe4f3',
          200: '#c0c9e8',
          300: '#93a1d6',
          400: '#6478c2',
          500: '#3355ad',
          600: '#223f95',
          700: '#16307a',
          800: '#0e2361',
          900: '#081a50',
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
          400: '#ffc63d',
          500: '#fbb308',
          600: '#d99400',
        },
        // Full LIBERIA360 logo palette for the responsive product UI. Keep
        // semantic states on the existing `flag` scale; these named tokens
        // are for brand expression, category accents, and editorial framing.
        liberia: {
          navy: '#081a50',
          royal: '#3355ad',
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
          300: '#e9aaab',
          400: '#e57678',
          500: '#e21f22',
          600: '#c80305',
          700: '#a10204',
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
        // the brand navy instead of pure black.
        card: '0 2px 8px -2px rgba(8, 26, 80, 0.08), 0 8px 24px -6px rgba(8, 26, 80, 0.10)',
        'card-hover': '0 4px 14px -2px rgba(8, 26, 80, 0.12), 0 16px 32px -8px rgba(8, 26, 80, 0.16)',
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
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.5s ease-out both',
        'fade-in': 'fadeIn 0.6s ease-out both',
        float: 'float 3.5s ease-in-out infinite',
        'splash-bar': 'splashBar 1.1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
