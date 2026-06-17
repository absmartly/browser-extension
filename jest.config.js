/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jest-environment-jsdom',
  roots: ['<rootDir>/src', '<rootDir>/background', '<rootDir>/tests/unit'],
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
    '^.+\\.(js|jsx|mjs)$': ['babel-jest', {
      presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
    }],
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
    // Allow Jest tests under tests/unit/, but ignore everything else under tests/ (Playwright e2e, etc).
    '<rootDir>/tests/(?!unit/)',
    // Existing Playwright-style files inside tests/unit/ that import @playwright/test or hit a live bridge.
    '<rootDir>/tests/unit/(claude-bridge|ExperimentCodeInjection|ExperimentDetail|ExperimentEditor|ExperimentMetadata|VariantList)\\.test\\.tsx?$',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(@plasmohq/storage|@absmartly/cli|pify|marked))',
  ],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/tests/mocks/styleMock.js',
    '^@absmartly/cli/api-client$': '<rootDir>/tests/mocks/absmartly-cli-api-client.js',
    '^~style\\.css$': '<rootDir>/tests/mocks/styleMock.js',
    '^~src/(.*)$': '<rootDir>/src/$1',
    '^~(.*)$': '<rootDir>/$1',
  },
  verbose: true,
}