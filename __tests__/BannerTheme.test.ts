/**
 * Unit tests for deriveBannerThemeColors — the "Common Appearance" theme
 * (background/text/button colors, font) applied to the general Notice
 * banner (BannerUI and its children).
 */
import { deriveBannerThemeColors, resolveFontFamily } from '../src/utils/ColorUtils';
import { Platform } from 'react-native';

describe('deriveBannerThemeColors', () => {
  it('uses light-mode defaults when nothing is configured', () => {
    const theme = deriveBannerThemeColors({});
    expect(theme).toEqual({
      background: '#ffffff',
      text: '#111827',
      textMuted: '#6b7280',
      button: '#3b82f6',
      buttonText: '#ffffff',
      border: '#e5e7eb',
      fontFamily: undefined,
      fontSize: 16,
      infoBg: '#eff6ff',
      infoBorder: '#bfdbfe',
      infoText: '#1e40af',
    });
  });

  it('uses dark-mode disclaimer presets when the resolved background is dark', () => {
    const theme = deriveBannerThemeColors({ primary_color: '#000000' });
    expect(theme.infoBg).toBe('#0a0c10');
    expect(theme.infoBorder).toBe('#1e293b');
    expect(theme.infoText).toBe('#60a5fa');
  });

  it('reads every "Common Appearance" field when configured', () => {
    const theme = deriveBannerThemeColors({
      background_color: '#000000',
      primary_text_color: '#ffffff',
      secondary_text_color: '#aab6cb',
      button_color: '#95ff00',
      button_text_color: '#0b1120',
      font_type: 'Arial',
      font_size: '16px',
    });
    expect(theme.background).toBe('#000000');
    expect(theme.text).toBe('#ffffff');
    expect(theme.textMuted).toBe('#aab6cb');
    expect(theme.button).toBe('#95ff00');
    expect(theme.buttonText).toBe('#0b1120');
    expect(theme.fontFamily).toBe('Arial');
    expect(theme.fontSize).toBe(16);
  });

  it('falls back button color to primary_color when button_color is absent', () => {
    const theme = deriveBannerThemeColors({ primary_color: '#7030bc' });
    expect(theme.button).toBe('#7030bc');
  });

  it('background reads primary_color — the actual "Background Color" API field', () => {
    // The admin dashboard's "Background Color" field maps to primary_color,
    // not background_color (no such API field exists) — see
    // AppearanceSettingsForm.tsx's <ColorField id="primary_color"
    // label="Background Color" .../>.
    const theme = deriveBannerThemeColors({ primary_color: '#000000' });
    expect(theme.background).toBe('#000000');
  });

  it('primary_color takes priority over background_color for background', () => {
    const theme = deriveBannerThemeColors({
      primary_color: '#000000',
      background_color: '#1f2937',
    });
    expect(theme.background).toBe('#000000');
  });

  it('parses a unit-suffixed font_size (e.g. "16px")', () => {
    expect(deriveBannerThemeColors({ font_size: '18px' }).fontSize).toBe(18);
    expect(deriveBannerThemeColors({ font_size: '14' }).fontSize).toBe(14);
  });

  it('falls back to 16 for an invalid font_size', () => {
    expect(deriveBannerThemeColors({ font_size: 'not-a-number' }).fontSize).toBe(16);
    expect(deriveBannerThemeColors({ font_size: '0' }).fontSize).toBe(16);
  });
});

describe('resolveFontFamily', () => {
  // Neither Android nor iOS ships web font names like "Garamond" — this SDK
  // bundles no font files, so an unresolvable fontFamily is silently
  // ignored by the OS. resolveFontFamily approximates the configured font
  // with the nearest one each platform actually has, rather than always
  // rendering the system default regardless of what's configured.
  const originalOS = Platform.OS;
  afterEach(() => {
    Platform.OS = originalOS;
  });

  it('returns undefined when nothing is configured', () => {
    expect(resolveFontFamily(undefined)).toBeUndefined();
    expect(resolveFontFamily('')).toBeUndefined();
  });

  it('on Android, maps a serif web font name to the generic "serif" family', () => {
    Platform.OS = 'android';
    expect(resolveFontFamily('Garamond')).toBe('serif');
    expect(resolveFontFamily('Georgia')).toBe('serif');
    expect(resolveFontFamily('Times New Roman')).toBe('serif');
  });

  it('on Android, maps a monospace web font name to the generic "monospace" family', () => {
    Platform.OS = 'android';
    expect(resolveFontFamily('Courier New')).toBe('monospace');
  });

  it('on Android, falls back to "sans-serif" for anything else', () => {
    Platform.OS = 'android';
    expect(resolveFontFamily('Arial')).toBe('sans-serif');
    expect(resolveFontFamily('Poppins')).toBe('sans-serif');
  });

  it('on iOS, passes through a font iOS actually ships unchanged', () => {
    Platform.OS = 'ios';
    expect(resolveFontFamily('Georgia')).toBe('Georgia');
    expect(resolveFontFamily('Courier New')).toBe('Courier New');
  });

  it('on iOS, maps an unshipped serif/monospace web font name to a real iOS equivalent', () => {
    Platform.OS = 'ios';
    expect(resolveFontFamily('Garamond')).toBe('Georgia');
    expect(resolveFontFamily('Consolas')).toBe('Courier New');
  });

  it('on iOS, passes through an unrecognized font name unchanged (best effort)', () => {
    Platform.OS = 'ios';
    expect(resolveFontFamily('Poppins')).toBe('Poppins');
  });
});
