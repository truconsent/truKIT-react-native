module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
      },
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-i18next|i18next)/)',
  ],
  testMatch: ['**/__tests__/**/*.test.(ts|tsx|js)'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    // Must each resolve to their own distinct file — see
    // jest.react-native-mock.js's comment for why aliasing multiple module
    // names to the same target file breaks resolution once any of them is
    // also registered via jest.mock() (as react-i18next/react-native-localize
    // are, in jest.setup.js).
    '^react-native$': '<rootDir>/jest.react-native-mock.js',
    '^react-i18next$': '<rootDir>/jest.setup.js',
    '^react-native-localize$': '<rootDir>/jest.setup.js',
  },
  globals: {
    'ts-jest': {
      tsconfig: {
        jsx: 'react',
      },
    },
  },
};

