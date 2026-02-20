/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jest-environment-jsdom',
  roots: ['<rootDir>/src', '<rootDir>/background'],
  testMatch: ['**/__tests__/**/*.test.(ts|tsx|js)', '**/?(*.)+(spec|test).(ts|tsx|js)'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        verbatimModuleSyntax: false,
        moduleResolution: 'node',
        module: 'esnext',
        target: 'es2017',
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true,
        strict: false,
      }
    }],
    '^.+\\.(js|jsx|mjs)$': 'babel-jest',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    'background/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!background/**/*.d.ts',
    '!background/**/index.ts',
  ],
  setupFilesAfterEnv: [
    '<rootDir>/src/__tests__/setup.ts',
    '<rootDir>/tests/setup/jest.setup.ts'
  ],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/tests/', // Ignore Playwright tests
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(@plasmohq/storage|pify|marked))',
  ],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/tests/mocks/styleMock.js',
    '^~src/(.*)$': '<rootDir>/src/$1',
    '^~(.*)$': '<rootDir>/$1',
  },
  verbose: true,
}