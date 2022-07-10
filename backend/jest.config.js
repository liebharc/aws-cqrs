module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  // Fix for a Jest bug, thanks to https://github.com/tomi/jest-import-bug/blob/main/jest.config.js
  resolver: '<rootDir>/resolver.js',
};
