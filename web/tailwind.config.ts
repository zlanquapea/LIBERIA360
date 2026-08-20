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
        flag: {
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
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.5s ease-out both',
        'fade-in': 'fadeIn 0.6s ease-out both',
        float: 'float 3.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
