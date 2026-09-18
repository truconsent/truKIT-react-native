// Dedicated `react-native` mock module.
//
// This MUST be a separate file from jest.setup.js. jest.config.js's
// moduleNameMapper used to point react-native, react-i18next, and
// react-native-localize all at jest.setup.js — since jest.mock() (used
// there for react-i18next/react-native-localize) registers by *resolved*
// module path, and moduleNameMapper resolves all three names to the exact
// same file, a jest.mock() call for one of them silently overrides what
// every other aliased name resolves to. In practice this made
// `import { Platform } from 'react-native'` resolve to the
// react-native-localize mock's shape ({ getLocales }) instead of
// { Platform, StyleSheet, ... } — Platform was `undefined`, breaking any
// code (or test) that reads Platform.OS.
module.exports = {
  Platform: {
    OS: 'ios',
    select: jest.fn((dict) => dict.ios),
  },
  StyleSheet: {
    create: (styles) => styles,
  },
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView',
  Modal: 'Modal',
  Pressable: 'Pressable',
  ActivityIndicator: 'ActivityIndicator',
  Image: 'Image',
  Switch: 'Switch',
  useWindowDimensions: () => ({ width: 400, height: 800 }),
  Linking: {
    openURL: jest.fn(),
  },
};
