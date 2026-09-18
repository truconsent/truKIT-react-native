/**
 * Color utility functions for theme support
 * Matches web implementation color transformations
 */
import { Platform } from 'react-native';

/**
 * Convert hex color to RGBA string
 * Supports 3-digit and 6-digit hex formats
 * @param hex - Hex color code (e.g., '#ff0000' or '#f00')
 * @param alpha - Alpha value (0-1)
 * @returns RGBA string (e.g., 'rgba(255, 0, 0, 0.5)') or null if invalid
 */
export const hexToRgba = (hex: string | null | undefined, alpha: number): string | null => {
  if (typeof hex !== 'string') return null;
  
  const clean = hex.replace('#', '').trim();
  if (![3, 6].includes(clean.length)) return null;
  
  // Expand 3-digit hex to 6-digit
  const full = clean.length === 3 
    ? clean.split('').map((ch) => ch + ch).join('') 
    : clean;
  
  // Parse hex to integer
  const intVal = Number.parseInt(full, 16);
  if (Number.isNaN(intVal)) return null;
  
  // Extract RGB components
  const r = (intVal >> 16) & 255;
  const g = (intVal >> 8) & 255;
  const b = intVal & 255;
  
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Parse RGBA string and return as object
 * Useful for breaking down computed colors
 * @param rgba - RGBA string (e.g., 'rgba(255, 0, 0, 0.5)')
 * @returns Object with r, g, b, a properties or null if invalid
 */
export const parseRgba = (rgba: string): { r: number; g: number; b: number; a: number } | null => {
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) return null;
  
  return {
    r: parseInt(match[1], 10),
    g: parseInt(match[2], 10),
    b: parseInt(match[3], 10),
    a: match[4] ? parseFloat(match[4]) : 1,
  };
};

/**
 * Generate theme colors from base API settings
 * Matches web implementation's color derivation
 */
export const deriveThemeColors = (settings: {
  background_color?: string;
  primary_text_color?: string;
  secondary_text_color?: string;
  button_color?: string;
  button_text_color?: string;
}) => {
  const bg = settings.background_color || '#020617';
  const primaryText = settings.primary_text_color || '#e5e7eb';
  const secondaryText = settings.secondary_text_color || '#9ca3af';
  const primary = settings.button_color || '#65a30d';
  const buttonText = settings.button_text_color || '#0b1120';

  return {
    background: bg,
    textPrimary: primaryText,
    textSecondary: secondaryText,
    button: primary,
    buttonText: buttonText,
    
    // Derived colors (matching web implementation)
    hoverBg: hexToRgba(primaryText, 0.08) || 'rgba(255, 255, 255, 0.06)',
    border: hexToRgba(secondaryText, 0.45) || 'rgba(107, 114, 128, 0.45)',
    infoBg: hexToRgba(primary, 0.12) || 'rgba(101, 163, 13, 0.12)',
    infoBorder: hexToRgba(primary, 0.25) || 'rgba(101, 163, 13, 0.25)',
    
    // Standard status colors
    successBg: 'rgba(34, 197, 94, 0.18)',
    successText: '#166534',
    dangerBg: 'rgba(239, 68, 68, 0.18)',
    dangerText: '#991b1b',
    dangerBtn: '#dc2626',
    dangerBtnHover: '#b91c1c',
    warningBg: 'rgba(245, 158, 11, 0.12)',
    warningBorder: 'rgba(245, 158, 11, 0.28)',
    warningText: '#fbbf24',
    
    // Overlay
    overlay: 'rgba(2, 6, 23, 0.72)',
  };
};

/** Resolved theme for the general Notice/consent banner (BannerUI and its
 * children) — background, text, and button colors plus font family/size,
 * all sourced from the banner's "Common Appearance" settings. Unlike
 * {@link deriveThemeColors} (Rights Center, dark defaults), this uses the
 * light-mode defaults truKIT-NPM's own `variables.css`/`TruConsentModal.jsx`
 * fall back to when a field isn't configured. */
export interface BannerTheme {
  background: string;
  text: string;
  textMuted: string;
  button: string;
  buttonText: string;
  border: string;
  fontFamily?: string;
  fontSize: number;
}

// Fonts the admin dashboard's "Font Type" dropdown commonly offers (web font
// names like Garamond, Georgia, Verdana) are almost never actually present
// on a phone — neither Android nor iOS ships them, and this SDK doesn't
// bundle any font files, so `fontFamily: 'Garamond'` silently falls back to
// the platform default with no warning. Rather than let the configured font
// have zero visible effect, resolve it to the nearest font each OS *does*
// ship: Android only resolves its 5 generic family keywords
// (sans-serif/serif/monospace/casual/cursive) without a bundled font file;
// iOS ships a larger set of real named fonts (Georgia, Courier New, ...)
// that can be used directly. This is a best-effort visual approximation,
// not the exact configured typeface — the only way to render the exact
// font is for the consuming app to bundle that font file.
const IOS_NAMED_FONTS = new Set([
  'Georgia', 'Times New Roman', 'Courier New', 'Courier', 'Verdana', 'Trebuchet MS',
  'Arial', 'Helvetica', 'Helvetica Neue', 'American Typewriter', 'Baskerville',
  'Palatino', 'Optima', 'Didot', 'Futura', 'Avenir', 'Menlo',
]);
const SERIF_KEYWORDS = [
  'garamond', 'georgia', 'times', 'serif', 'baskerville', 'palatino', 'cambria',
  'constantia', 'didot', 'book antiqua', 'century', 'goudy', 'minion', 'caslon',
];
const MONOSPACE_KEYWORDS = ['courier', 'mono', 'consolas', 'menlo', 'monaco'];

export const resolveFontFamily = (configured?: string | null): string | undefined => {
  if (!configured) return undefined;
  const lower = configured.toLowerCase();

  if (Platform.OS === 'ios') {
    if (IOS_NAMED_FONTS.has(configured)) return configured;
    if (SERIF_KEYWORDS.some((k) => lower.includes(k))) return 'Georgia';
    if (MONOSPACE_KEYWORDS.some((k) => lower.includes(k))) return 'Courier New';
    return configured;
  }

  // Android: only the generic family keywords resolve without a bundled font.
  if (SERIF_KEYWORDS.some((k) => lower.includes(k))) return 'serif';
  if (MONOSPACE_KEYWORDS.some((k) => lower.includes(k))) return 'monospace';
  if (lower === 'sans-serif' || lower === 'casual' || lower === 'cursive') return lower;
  return 'sans-serif';
};

export const deriveBannerThemeColors = (settings: {
  background_color?: string;
  primary_text_color?: string;
  secondary_text_color?: string;
  primary_color?: string;
  button_color?: string;
  button_text_color?: string;
  font_type?: string;
  font_size?: string;
} = {}): BannerTheme => {
  const parsedFontSize = settings.font_size ? parseFloat(settings.font_size) : NaN;
  return {
    // The admin dashboard's "Background Color" field is actually
    // `primary_color` (see AppearanceSettingsForm.tsx's
    // `<ColorField id="primary_color" label="Background Color" .../>`) —
    // there is no `background_color` column anywhere in the API. Prioritize
    // `primary_color`; `background_color` is kept only as a defensive
    // fallback in case a caller ever sends that key directly.
    background: settings.primary_color || settings.background_color || '#ffffff',
    text: settings.primary_text_color || '#111827',
    textMuted: settings.secondary_text_color || '#6b7280',
    button: settings.button_color || settings.primary_color || '#3b82f6',
    buttonText: settings.button_text_color || '#ffffff',
    border: '#e5e7eb',
    fontFamily: resolveFontFamily(settings.font_type),
    fontSize: Number.isFinite(parsedFontSize) && parsedFontSize > 0 ? parsedFontSize : 16,
  };
};

export default {
  hexToRgba,
  parseRgba,
  deriveThemeColors,
  deriveBannerThemeColors,
  resolveFontFamily,
};
