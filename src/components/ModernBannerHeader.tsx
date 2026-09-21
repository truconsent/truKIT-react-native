/**
 * ModernBannerHeader - React Native banner header component
 */
import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, Modal, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BannerTheme } from '../utils/ColorUtils';

export interface ModernBannerHeaderProps {
  logoUrl?: string;
  orgName: string;
  bannerTitle?: string;
  disclaimerText?: string;
  /** "Common Appearance" theme — background/text colors, font. */
  theme?: BannerTheme;
  /** Translates dynamic (server-supplied) text via the banner's translation
   * snapshot. Identity function if omitted. */
  translate?: (text: string) => string;
  /** Language codes actually configured for this banner (from the API's
   * translation snapshot), not a fixed built-in set. */
  availableLanguages?: string[];
  languageLabels?: Record<string, string>;
  selectedLanguage?: string;
  onLanguageChange?: (lang: string) => void;
}

const BUILT_IN_LABELS: Record<string, string> = {
  en: 'English',
  ta: 'தமிழ்',
  hi: 'हिंदी',
};

export default function ModernBannerHeader({
  logoUrl,
  orgName,
  bannerTitle,
  disclaimerText,
  theme,
  translate = (text: string) => text || '',
  availableLanguages,
  languageLabels = {},
  selectedLanguage,
  onLanguageChange,
}: ModernBannerHeaderProps) {
  const { t, i18n } = useTranslation();
  const [isLangOpen, setIsLangOpen] = useState(false);

  // Prefer the banner's own snapshot-driven language list (whatever the
  // admin actually configured); fall back to the static i18next bundle
  // (en/ta/hi) only when no snapshot is available at all.
  const languages = availableLanguages && availableLanguages.length > 0
    ? availableLanguages
    : ['en', 'ta', 'hi'];
  const isSnapshotDriven = !!(availableLanguages && availableLanguages.length > 0);
  const currentLanguage = isSnapshotDriven ? (selectedLanguage ?? 'en') : i18n.language;

  const getLanguageLabel = (code: string) =>
    languageLabels[code] || BUILT_IN_LABELS[code] || code.toUpperCase();

  const changeLanguage = (lng: string) => {
    if (isSnapshotDriven) {
      onLanguageChange?.(lng);
    } else {
      i18n.changeLanguage(lng);
    }
    setIsLangOpen(false);
  };

  // Google Translate translates "[Organization Name]" into the target
  // language's own equivalent bracket phrase (e.g. Tamil:
  // "[நிறுவனத்தின் பெயர்]") — match any [...] bracket group, not just the
  // literal English phrase, so the placeholder still gets replaced after
  // translation. Matches truKIT-NPM's ModernBannerHeader.jsx exactly.
  const processPlaceholder = (text: string) =>
    (text || '')
      .replace(/\[[^\]()]+\](?!\()/g, orgName || '')
      .replace(/\{\{companyName\}\}/g, orgName || '');

  // Normalizes away the placeholder token (either the literal
  // "[Organization Name]"/"{{companyName}}", or a Google-Translate'd bracket
  // in another language) so the backend's *default* title/disclaimer text
  // can be recognized regardless of which placeholder form is present.
  const normalizeForCompare = (s: string) =>
    s.replace(/\[[^\]()]+\]|\{\{companyName\}\}/g, '{{X}}').trim();

  const DEFAULT_TITLE_EN = 'Consent by [Organization Name]';
  const DEFAULT_DISCLAIMER_EN =
    'You have the right to decline consents which you feel are not required by [Organization Name]';

  // `t()` reads from i18next's own active locale, which only actually
  // changes in the non-snapshot fallback mode (see `changeLanguage` above —
  // snapshot-driven banners report the language via `onLanguageChange`
  // instead, so i18next's locale otherwise stays 'en'). Passing `lng`
  // explicitly makes the static hi/ta translations apply for a
  // snapshot-driven `currentLanguage` too.
  const tLang = (key: string, options?: Record<string, unknown>) =>
    t(key, { ...options, lng: currentLanguage });

  // When the admin never customized this field, `raw` is empty — but the
  // server's translation snapshot still keys its entry by the backend's
  // *literal default English sentence* (confirmed against a live banner:
  // `disclaimerText` was `''`, yet `text_map` had a real Bengali/Kannada
  // translation for "You have the right to decline consents which you feel
  // are not required by [Organization Name]"). Translating an empty string
  // always returns identity, so this must feed `defaultEn` to `translate()`
  // instead of `raw` whenever `raw` is empty — otherwise the snapshot's
  // translation is never even looked up, and only the static i18next bundle
  // (which covers just hi/ta) gets a chance, silently showing English for
  // every other configured language despite the snapshot having the answer.
  const resolveWithDefaultFallback = (
    raw: string,
    defaultEn: string,
    i18nKey: string
  ): string => {
    const sourceText = raw || defaultEn;
    const translated = translate(sourceText);
    if (translated !== sourceText) return processPlaceholder(translated);
    if (!raw || normalizeForCompare(raw) === normalizeForCompare(defaultEn)) {
      return tLang(i18nKey, { companyName: orgName });
    }
    return processPlaceholder(translated);
  };

  const title = resolveWithDefaultFallback(bannerTitle || '', DEFAULT_TITLE_EN, 'consent_by');
  const disclaimer = resolveWithDefaultFallback(
    disclaimerText || '',
    DEFAULT_DISCLAIMER_EN,
    'decline_rights'
  );

  const textColor = theme?.text ?? '#1f2937';
  const mutedColor = theme?.textMuted ?? '#4b5563';
  const fontFamily = theme?.fontFamily;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
      <View style={styles.headerLeft}>
        {logoUrl && (
          <>
            <Image source={{ uri: logoUrl }} style={styles.logo} resizeMode="contain" />
            <View style={{ width: 16 }} />
          </>
        )}
        <Text style={[styles.title, { color: textColor, fontFamily }]}>{title}</Text>
      </View>
        {languages.length > 1 && (
          <View style={styles.languageContainer}>
            <TouchableOpacity
              style={styles.languageButton}
              onPress={() => setIsLangOpen(true)}
            >
              <Text style={[styles.languageText, { color: mutedColor, fontFamily }]} numberOfLines={1}>
                {getLanguageLabel(currentLanguage)}
              </Text>
              <View style={{ width: 4 }} />
              <Text style={[styles.chevron, { color: mutedColor }]}>▼</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Rendered as a bottom-sheet Modal (not a locally-anchored absolute
       * dropdown) — a small anchored dropdown risked overlapping a
       * multi-line wrapped title/disclaimer on narrow phone screens once
       * translated, and a full-screen sheet is the more standard mobile
       * pattern for a list that can hold 20+ languages anyway. */}
      <Modal
        visible={isLangOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLangOpen(false)}
      >
        <Pressable style={styles.languageModalOverlay} onPress={() => setIsLangOpen(false)}>
          <Pressable
            style={[
              styles.languageModalSheet,
              { backgroundColor: theme?.background ?? 'white' },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.languageModalHandle} />
            <Text style={[styles.languageModalTitle, { color: textColor, fontFamily }]}>
              {t('select_language')}
            </Text>
            <ScrollView style={styles.languageModalScroll} showsVerticalScrollIndicator={true}>
              {languages.map((code) => (
                <TouchableOpacity
                  key={code}
                  style={[styles.languageOption, { borderBottomColor: theme?.border ?? '#f3f4f6' }]}
                  onPress={() => changeLanguage(code)}
                >
                  <Text
                    style={[
                      styles.languageOptionText,
                      { color: theme?.text ?? '#374151', fontFamily },
                      code === currentLanguage && { fontWeight: '700', color: theme?.button ?? '#3b82f6' },
                    ]}
                  >
                    {getLanguageLabel(code)}
                  </Text>
                  {code === currentLanguage && (
                    <Text style={{ color: theme?.button ?? '#3b82f6', fontWeight: '700' }}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      {/* Matches truKIT-NPM's var(--banner-info-bg/border/text) — the disclaimer
          box was fully hardcoded here, ignoring theme entirely. */}
      <View style={[styles.disclaimer, { backgroundColor: theme?.infoBg ?? '#dbeafe', borderColor: theme?.infoBorder ?? '#93c5fd' }]}>
        <Text style={[styles.disclaimerText, { fontFamily, color: theme?.infoText ?? '#1e40af' }]}>{disclaimer}</Text>
      </View>
      <View style={styles.divider} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logo: {
    width: 32,
    height: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    flex: 1,
  },
  languageContainer: {
    maxWidth: 110,
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  languageText: {
    fontSize: 14,
    color: '#4b5563',
  },
  chevron: {
    fontSize: 12,
    color: '#4b5563',
  },
  languageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  languageModalSheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    paddingHorizontal: 8,
    paddingBottom: 24,
    maxHeight: '70%',
  },
  languageModalHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d1d5db',
    marginBottom: 12,
  },
  languageModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  languageModalScroll: {
    flexGrow: 0,
  },
  languageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  languageOptionText: {
    fontSize: 14,
    color: '#374151',
  },
  disclaimer: {
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 8,
    padding: 16,
  },
  disclaimerText: {
    fontSize: 14,
    color: '#1e40af',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
  },
});
