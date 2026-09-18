/**
 * Font files for the admin dashboard's "Font Type" dropdown (Common
 * Appearance settings) — `BannerTheme.fontFamily` (ColorUtils.ts) is
 * resolved from the configured `font_type` string and applied directly to
 * every `<Text>` in the consent notice, so each family below must be
 * registered under the *exact* name the dropdown offers. Without this,
 * neither Android nor iOS has any of these fonts installed, and RN's
 * `fontFamily` — unlike a web `<link>` — never fetches one on demand: an
 * unresolvable name is silently ignored by the OS, with no error.
 *
 * The proprietary system fonts (Arial, Helvetica, Verdana, Tahoma,
 * Trebuchet MS, Times New Roman, Georgia, Garamond, Courier New) are
 * commercial typefaces owned by Monotype/Apple/Microsoft — their actual
 * font files can't be redistributed here. Each is instead mapped to a
 * freely-licensed (OFL/Apache/Ubuntu Font License), visually similar, and
 * in several cases metric-compatible open substitute — registered under the
 * *original* family name so `font_type: 'Garamond'` etc. still resolves
 * correctly without any extra mapping logic. "Sans-serif" needs no asset —
 * `resolveFontFamily` (ColorUtils.ts) already maps it to each platform's own
 * built-in generic family.
 *
 * The consuming app must load these once at startup via `expo-font`'s
 * `useFonts(CONSENT_NOTICE_FONTS)` (or `Font.loadAsync`) before rendering
 * any screen that can show the consent banner — see this package's README.
 */
export const CONSENT_NOTICE_FONTS: Record<string, number> = {
  // Exact matches — genuinely free Google Fonts, matching the dropdown 1:1.
  Inter: require('../../assets/fonts/Inter.ttf'),
  Roboto: require('../../assets/fonts/Roboto.ttf'),
  'Open Sans': require('../../assets/fonts/OpenSans.ttf'),
  Lato: require('../../assets/fonts/Lato.ttf'),
  Montserrat: require('../../assets/fonts/Montserrat.ttf'),
  Poppins: require('../../assets/fonts/Poppins.ttf'),
  Nunito: require('../../assets/fonts/Nunito.ttf'),
  Raleway: require('../../assets/fonts/Raleway.ttf'),
  'Source Sans Pro': require('../../assets/fonts/SourceSansPro.ttf'),
  Merriweather: require('../../assets/fonts/Merriweather.ttf'),
  'PT Sans': require('../../assets/fonts/PTSans.ttf'),
  Ubuntu: require('../../assets/fonts/Ubuntu.ttf'),
  'Work Sans': require('../../assets/fonts/WorkSans.ttf'),
  Rubik: require('../../assets/fonts/Rubik.ttf'),

  // Proprietary system fonts — registered under their original name, but
  // pointing at a free open substitute (see comment above).
  Arial: require('../../assets/fonts/Arimo.ttf'),
  Helvetica: require('../../assets/fonts/Arimo.ttf'),
  Verdana: require('../../assets/fonts/NotoSans.ttf'),
  Tahoma: require('../../assets/fonts/NotoSans.ttf'),
  'Trebuchet MS': require('../../assets/fonts/NotoSans.ttf'),
  'Times New Roman': require('../../assets/fonts/Tinos.ttf'),
  Georgia: require('../../assets/fonts/Gelasio.ttf'),
  Garamond: require('../../assets/fonts/EBGaramond.ttf'),
  'Courier New': require('../../assets/fonts/Cousine.ttf'),
};

export default CONSENT_NOTICE_FONTS;
