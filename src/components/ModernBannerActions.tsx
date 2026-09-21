/**
 * ModernBannerActions - React Native banner actions component
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Purpose } from '../core/types';
import { hasOptionalAccepted } from '../core/ConsentManager';
import { BannerTheme } from '../utils/ColorUtils';

export interface ModernBannerActionsProps {
  onRejectAll: () => void;
  onConsentAll: () => void;
  onAcceptSelected: () => void;
  /** "Only Necessary" — accept mandatory, decline optional. Matches
   * truKIT-NPM's ModernBannerActions.jsx, where this is always a distinct,
   * persistently-rendered third handler, never swapped in for
   * `onAcceptSelected`. */
  onAcceptMandatory: () => void;
  purposes: Purpose[];
  actionButtonText?: string;
  primaryColor?: string;
  theme?: BannerTheme;
  /** Per-notice "Global Settings" overrides for the Reject All button. */
  rejectAllColor?: string;
  rejectAllText?: string;
  /** Per-notice "Global Settings" overrides for the Only Necessary button. */
  onlyNecessaryColor?: string;
  onlyNecessaryText?: string;
  /** True once the user has toggled any purpose this session — matches
   * truKIT-NPM's `hasUserInteracted`, which (together with
   * `anyOptionalAccepted`) decides whether the dynamic third button submits
   * via `onConsentAll` or `onAcceptSelected`. */
  hasUserInteracted?: boolean;
  /** Matches truKIT-NPM's `isBottomReached` — whether the user has scrolled
   * through every purpose. Defaults to `true` (no gating) for callers that
   * don't track scroll position, matching truKIT-NPM's simpler templates
   * (CompactListUI/SplitPaneUI/InlineSingleRowUI), which always pass
   * `isBottomReached={true}`. */
  isBottomReached?: boolean;
  /** Translates dynamic (server-supplied) text via the banner's translation
   * snapshot. Falls back to the static i18next bundle, then the original
   * text, if the snapshot has no match — matches truKIT-NPM's
   * ModernBannerActions.jsx, which wraps every button label in translate()
   * (including custom admin-configured text like rejectAllText). */
  translate?: (text: string) => string;
}

export default function ModernBannerActions({
  onRejectAll,
  onConsentAll,
  onAcceptSelected,
  onAcceptMandatory,
  purposes = [],
  actionButtonText,
  primaryColor = '#3b82f6',
  theme,
  rejectAllColor,
  rejectAllText,
  onlyNecessaryColor,
  onlyNecessaryText,
  hasUserInteracted = false,
  isBottomReached = true,
  translate,
}: ModernBannerActionsProps) {
  const { width: screenWidth } = useWindowDimensions();
  const isSmallMobile = screenWidth < 380;

  const anyOptionalAccepted = hasOptionalAccepted(purposes);
  // Legitimate Interest purposes are never toggleable (no switch is even
  // rendered for them — see ModernPurposeCard.tsx) and can never be
  // "accepted" by the user, so they must not count toward "optional
  // purposes exist" — otherwise a banner with only Legitimate Interest +
  // mandatory purposes (no real optional consent purpose at all) would
  // permanently disable "I Consent", since anyOptionalAccepted can never
  // become true. Matches hasOptionalAccepted's own filter.
  const optionalPurposes = purposes.filter((p) => !p.is_mandatory && !p.is_legitimate);
  const hasOptional = optionalPurposes.length > 0;
  // Matches truKIT-NPM's ModernBannerActions.jsx exactly: scrolling isn't
  // required when there's only a single optional purpose to review.
  const isSinglePurpose = optionalPurposes.length === 1;
  const scrollRequired = !isSinglePurpose;
  const showScrollWarning = scrollRequired && !isBottomReached;
  const isActionsEnabled = !scrollRequired || isBottomReached;

  // Admin-configurable button text (action_button_text/reject_all_text/
  // only_necessary_text) must never be silently swapped for a *different*
  // generic i18n-bundle string when there's no snapshot translation for it —
  // matches truKIT-NPM's ModernBannerActions.jsx, which is just
  // `translate(customText || defaultLiteral)`: snapshot-translate if there's
  // a match, otherwise show the literal (including the admin's actual
  // configured override) as-is.
  const trConfigurable = (customText: string | undefined, defaultText: string): string => {
    const text = customText || defaultText;
    return translate ? translate(text) : text;
  };

  // Matches truKIT-NPM's ModernBannerActions.jsx exactly: the third button's
  // *label* never changes ("I Consent"/actionButtonText, always) — only its
  // handler switches, once the user has an optional purpose accepted or has
  // interacted with a toggle this session.
  const isIConsentEnabled = isActionsEnabled && (hasOptional ? anyOptionalAccepted : true);
  const fontFamily = theme?.fontFamily;
  const buttonColor = theme?.button ?? primaryColor;
  const buttonTextColor = theme?.buttonText ?? 'white';

  const handleThirdButtonPress = () => {
    if (anyOptionalAccepted || hasUserInteracted) {
      onAcceptSelected();
    } else {
      onConsentAll();
    }
  };

  const rejectButton = (
    <TouchableOpacity
      style={[
        styles.rejectButton,
        isSmallMobile ? styles.buttonFullWidth : styles.buttonFlex,
        { backgroundColor: rejectAllColor || '#dc2626', opacity: isActionsEnabled ? 1 : 0.5 },
      ]}
      onPress={onRejectAll}
      disabled={!isActionsEnabled}
    >
      <Text style={[styles.rejectButtonText, { fontFamily }]} numberOfLines={1}>
        {trConfigurable(rejectAllText, 'Reject All')}
      </Text>
    </TouchableOpacity>
  );

  // Persistent — matches truKIT-NPM, which never swaps this button out once
  // an optional purpose is toggled on (unlike the old dual-mode handler this
  // replaces).
  const onlyNecessaryButton = (
    <TouchableOpacity
      style={[
        styles.onlyNecessaryButton,
        isSmallMobile ? styles.buttonFullWidth : styles.buttonFlex,
        { backgroundColor: onlyNecessaryColor || '#f97316', opacity: isActionsEnabled ? 1 : 0.5 },
      ]}
      onPress={onAcceptMandatory}
      disabled={!isActionsEnabled}
    >
      <Text style={[styles.onlyNecessaryButtonText, { fontFamily }]} numberOfLines={2}>
        {trConfigurable(onlyNecessaryText, 'Only Necessary')}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme?.background ?? '#f9fafb' }]}>
      {showScrollWarning && (
        <Text style={styles.scrollWarning}>
          {trConfigurable(undefined, 'Please scroll to the bottom to enable actions')}
        </Text>
      )}
      <TouchableOpacity
        style={[
          styles.primaryButton,
          { backgroundColor: isIConsentEnabled ? buttonColor : (theme?.border ?? '#9ca3af') },
        ]}
        onPress={handleThirdButtonPress}
        disabled={!isIConsentEnabled}
      >
        <Text style={[styles.primaryButtonText, { color: buttonTextColor, fontFamily }]} numberOfLines={1}>
          {trConfigurable(actionButtonText, 'I Consent')}
        </Text>
      </TouchableOpacity>
      <View style={isSmallMobile ? styles.secondaryColumn : styles.secondaryRow}>
        {rejectButton}
        {onlyNecessaryButton}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollWarning: {
    fontSize: 11,
    textAlign: 'center',
    color: '#9ca3af',
  },
  container: {
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  primaryButton: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'white',
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryColumn: {
    gap: 10,
  },
  buttonFlex: {
    flex: 1,
  },
  buttonFullWidth: {
    width: '100%',
  },
  rejectButton: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  onlyNecessaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  onlyNecessaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
  },
});
