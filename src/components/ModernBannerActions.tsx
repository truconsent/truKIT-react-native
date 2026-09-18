/**
 * ModernBannerActions - React Native banner actions component
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Purpose } from '../core/types';
import { hasOptionalAccepted, hasMandatoryPurposes } from '../core/ConsentManager';
import { BannerTheme } from '../utils/ColorUtils';

export interface ModernBannerActionsProps {
  onRejectAll: () => void;
  onConsentAll: () => void;
  onAcceptSelected: () => void;
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
  purposes = [],
  actionButtonText,
  primaryColor = '#3b82f6',
  theme,
  rejectAllColor,
  rejectAllText,
  onlyNecessaryColor,
  onlyNecessaryText,
  translate,
}: ModernBannerActionsProps) {
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const isMobile = screenWidth < 600;
  const isSmallMobile = screenWidth < 380;

  const anyOptionalAccepted = hasOptionalAccepted(purposes);
  const hasMandatory = hasMandatoryPurposes(purposes);

  // For static UI microcopy: prefer the server-driven snapshot (covers every
  // language the admin actually configured), falling back to the static
  // i18next bundle (only covers en/hi/ta) so those two languages keep
  // working even with no snapshot.
  const tr = (text: string, i18nKey?: string): string => {
    const snapshotResult = translate ? translate(text) : text;
    if (snapshotResult !== text) return snapshotResult;
    return i18nKey ? t(i18nKey) : text;
  };

  // Only Necessary state has a configurable label override (only_necessary_text);
  // the "Accept Selected" state has no equivalent field in truKIT-NPM, so it
  // keeps its i18n default.
  const dynamicButtonLabel = anyOptionalAccepted
    ? tr('Accept Selected', 'accept_selected')
    : tr(onlyNecessaryText || 'Only Necessary', 'accept_only_necessary');

  const isDisabled = !anyOptionalAccepted && !hasMandatory;
  const fontFamily = theme?.fontFamily;
  const buttonTextColor = theme?.buttonText ?? 'white';

  const rejectButton = (
    <TouchableOpacity
      style={[
        styles.rejectButton,
        isSmallMobile ? styles.buttonFullWidth : styles.buttonFlex,
        rejectAllColor
          ? { backgroundColor: rejectAllColor, borderColor: rejectAllColor }
          : null,
      ]}
      onPress={onRejectAll}
    >
      <Text
        style={[
          styles.rejectButtonText,
          { fontFamily },
          rejectAllColor ? { color: 'white' } : null,
        ]}
        numberOfLines={1}
      >
        {tr(rejectAllText || 'Reject All', 'reject_all')}
      </Text>
    </TouchableOpacity>
  );

  const acceptSelectedButton = (
    <TouchableOpacity
      style={[
        styles.acceptSelectedButton,
        isSmallMobile ? styles.buttonFullWidth : styles.buttonFlex,
        onlyNecessaryColor ? { backgroundColor: onlyNecessaryColor } : null,
        isDisabled && styles.disabledButton,
      ]}
      onPress={onAcceptSelected}
      disabled={isDisabled}
    >
      <Text
        style={[
          styles.acceptSelectedButtonText,
          { fontFamily },
          isDisabled && styles.disabledButtonText,
        ]}
        numberOfLines={2}
      >
        {dynamicButtonLabel}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme?.background ?? '#f9fafb' }]}>
      {/* Primary action (Accept All) is always full-width on top — mirrors
       * truKIT-flutter-sdk's ModernBannerActions layout. On very narrow
       * phones the two secondary buttons stack full-width too, instead of
       * wrapping into an uneven row. */}
      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: primaryColor }]}
        onPress={onConsentAll}
      >
        <Text style={[styles.primaryButtonText, { color: buttonTextColor, fontFamily }]} numberOfLines={1}>
          {tr(actionButtonText || 'Accept All', 'accept_all')}
        </Text>
      </TouchableOpacity>
      <View style={isSmallMobile ? styles.secondaryColumn : styles.secondaryRow}>
        {rejectButton}
        {acceptSelectedButton}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#fb923c',
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ea580c',
  },
  acceptSelectedButton: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#16a34a',
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
  },
  acceptSelectedButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
  },
  disabledButtonText: {
    color: '#f3f4f6',
  },
});
