// Jest setup file
//
// The react-native mock itself lives in jest.react-native-mock.js — a
// separate file, deliberately. jest.config.js's moduleNameMapper resolves
// react-i18next/react-native-localize to THIS file, and jest.mock() below
// registers by resolved path — aliasing react-native to this same file too
// let one jest.mock() call silently override what every other aliased name
// resolved to (see jest.react-native-mock.js's comment for the full story).

// Mock i18next
const mockI18next = {
  useTranslation: () => ({
    t: (key) => key,
    i18n: {
      language: 'en',
      changeLanguage: jest.fn(),
    },
  }),
  I18nextProvider: ({ children }) => children,
};

// Mock react-native-localize
const mockLocalize = {
  getLocales: () => [{ languageCode: 'en' }],
};

// Set up mocks for jest.mock calls
if (typeof jest !== 'undefined') {
  jest.mock('react-i18next', () => mockI18next);
  jest.mock('react-native-localize', () => mockLocalize);
}
