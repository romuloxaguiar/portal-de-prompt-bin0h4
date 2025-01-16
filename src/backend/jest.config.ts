import type { Config } from '@jest/types'; // @version ^29.0.0

const config: Config.InitialOptions = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Set Node.js as the test environment
  testEnvironment: 'node',

  // Define root directories for tests and source files
  roots: [
    '<rootDir>/src',
    '<rootDir>/tests'
  ],

  // Specify file extensions to be processed
  moduleFileExtensions: [
    'ts',
    'js',
    'json'
  ],

  // Configure module path aliases for clean imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@common/(.*)$': '<rootDir>/src/common/$1',
    '^@api-gateway/(.*)$': '<rootDir>/src/api-gateway/$1',
    '^@analytics/(.*)$': '<rootDir>/src/analytics-service/$1',
    '^@collaboration/(.*)$': '<rootDir>/src/collaboration-service/$1',
    '^@prompt/(.*)$': '<rootDir>/src/prompt-service/$1',
    '^@security/(.*)$': '<rootDir>/src/security/$1'
  },

  // Pattern for test file matching
  testRegex: '.*\\.test\\.ts$',

  // Configure TypeScript transformation
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest'
  },

  // Configure code coverage collection
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.type.ts',
    '!src/**/index.ts'
  ],

  // Set coverage output directory
  coverageDirectory: 'coverage',

  // Configure coverage report formats
  coverageReporters: [
    'text',
    'lcov',
    'json-summary'
  ],

  // Set minimum coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Set test timeout (in milliseconds)
  testTimeout: 30000,

  // Enable verbose test output
  verbose: true,

  // Configure test setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.ts'
  ]
};

export default config;