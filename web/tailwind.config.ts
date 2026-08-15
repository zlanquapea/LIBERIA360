import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
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
      },
    },
  },
  plugins: [],
};

export default config;
