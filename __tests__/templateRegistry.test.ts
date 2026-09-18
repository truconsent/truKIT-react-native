/**
 * Unit tests for templateRegistry
 */
import { resolveTemplateKey } from '../src/core/templateRegistry';

describe('resolveTemplateKey', () => {
  it('maps each known key to its template', () => {
    expect(resolveTemplateKey('preferences_modal')).toBe('preferences_modal');
    expect(resolveTemplateKey('floating_card')).toBe('floating_card');
    expect(resolveTemplateKey('notice_only')).toBe('notice_only');
    expect(resolveTemplateKey('inline_single_row')).toBe('inline_single_row');
    expect(resolveTemplateKey('general_compact_list')).toBe('general_compact_list');
    expect(resolveTemplateKey('general_split_pane')).toBe('general_split_pane');
    expect(resolveTemplateKey('tabbed_banner')).toBe('tabbed_banner');
  });

  it('collapses center_modal into tabbed_banner, mirroring the NPM SDK', () => {
    expect(resolveTemplateKey('center_modal')).toBe('tabbed_banner');
  });

  it('falls back to tabbed_banner for null/undefined/unknown keys', () => {
    expect(resolveTemplateKey(undefined)).toBe('tabbed_banner');
    expect(resolveTemplateKey(null)).toBe('tabbed_banner');
    expect(resolveTemplateKey('something_unrecognized')).toBe('tabbed_banner');
  });

  it('falls back to floating_card for cookie_consent banners with no explicit template', () => {
    expect(resolveTemplateKey(undefined, { consentType: 'cookie_consent' })).toBe('floating_card');
  });

  it('an explicit template key overrides the cookie_consent default', () => {
    expect(resolveTemplateKey('notice_only', { consentType: 'cookie_consent' })).toBe('notice_only');
  });
});
