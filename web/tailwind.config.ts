import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Placeholder brand palette — "National Geographic × Airbnb × Google
        // Maps" positioning (Tech Spec §1.1). Swap for real brand colors
        // once defined.
        brand: {
          50: '#eefaf4',
          100: '#d6f2e2',
          200: '#aee4c8',
          300: '#7ccfa8',
          400: '#4bb586',
          500: '#2c9a6c',
          600: '#1f7c57',
          700: '#1c6347',
          800: '#1a4f3b',
          900: '#174232',
        },
        sand: {
          50: '#fdfaf4',
          100: '#f8f0e0',
          200: '#f0dfbe',
          300: '#e4c78f',
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
