const nextJest = require('next/jest');

// next/jest wires up SWC (the same transform Next's own build uses) so
// TypeScript/JSX/the app's path aliases (@/*) all work without a separate
// babel/ts-jest config, and loads .env.local the same way `next dev` does.
const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // e2e/ holds Playwright specs (its own test/expect globals, run via
  // `npm run test:e2e`) — Jest's default testMatch would otherwise also
  // pick up its *.spec.ts files and fail trying to run them as unit tests.
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/', '<rootDir>/e2e/'],
};

module.exports = createJestConfig(customJestConfig);
