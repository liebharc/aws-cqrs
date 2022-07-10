/* eslint-disable */
/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
const { defaults } = require('jest-config');

module.exports = {
  moduleFileExtensions: [...defaults.moduleFileExtensions, 'ts', 'tsx'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  silent: false,
  moduleNameMapper: {
    // https://jestjs.io/docs/webpack
    '^.+\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/__mocks__/fileMock.js',
    '^.+\\.(css|scss|less)$': '<rootDir>/__mocks__/styleMock.js',
  },
  testRegex: '(/__tests__/.*\\.(test|spec))\\.[jt]sx?$',
};
