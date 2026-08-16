const nextJest = require('next/jest');

// next/jest wires up SWC (the same transform Next's own build uses) so
// TypeScript/JSX/the app's path aliases (@/*) all work without a separate
// babel/ts-jest config, and loads .env.local the same way `next dev` does.
const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
};

module.exports = createJestConfig(customJestConfig);
