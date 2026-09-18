/**
 * Banner template registry — mirrors the NPM SDK's
 * `src/runtime/templateRegistry.js`, mapping a
 * `banner_settings.general_notice_template` string to one of the SDK's
 * selectable banner layouts.
 */

export type BannerTemplateKey =
  /** Header + tabbed (Informational/Consent) or grouped
   * (Necessary/Optional/Profile Based) purpose list, depending on purpose
   * composition. Also used for the `center_modal` key — the NPM SDK
   * collapses `center_modal` into the same tabbed rendering by default, and
   * this SDK mirrors that. */
  | 'tabbed_banner'
  /** Simple stacked purpose-card list + Only Necessary / Save Preferences /
   * Accept All buttons (no Reject All). */
  | 'preferences_modal'
  /** The floating cookie-consent card layout. */
  | 'floating_card'
  /** Read-only purpose cards + a single acknowledge button, regardless of
   * purpose composition. */
  | 'notice_only'
  /** One row per purpose with all detail inline (no expand/collapse). */
  | 'inline_single_row'
  /** Accordion rows, one per purpose, collapsed by default. */
  | 'general_compact_list'
  /** A selectable purpose list alongside a detail pane for the active
   * purpose. */
  | 'general_split_pane';

const KNOWN_KEYS: BannerTemplateKey[] = [
  'preferences_modal',
  'floating_card',
  'notice_only',
  'inline_single_row',
  'general_compact_list',
  'general_split_pane',
];

/**
 * Resolves a `banner_settings.general_notice_template` string (or the
 * banner's `consent_type`) to a {@link BannerTemplateKey}. Unrecognized or
 * absent values fall back to `'tabbed_banner'`, matching
 * `templateRegistry.js`'s `getTemplate()` fallback to `center_modal` (which
 * itself resolves to the tabbed rendering).
 */
export function resolveTemplateKey(
  rawKey: string | undefined | null,
  options?: { consentType?: string }
): BannerTemplateKey {
  if (options?.consentType === 'cookie_consent' && !rawKey) {
    return 'floating_card';
  }
  if (rawKey && (KNOWN_KEYS as string[]).includes(rawKey)) {
    return rawKey as BannerTemplateKey;
  }
  return 'tabbed_banner';
}
