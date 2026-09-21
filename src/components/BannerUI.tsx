/**
 * BannerUI - React Native banner UI component with tabbed UI support
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Banner, Purpose } from '../core/types';
import { UIState, BannerCase, NormalizedPurpose } from '../core/ConsentManager';
import { BannerTheme, deriveBannerThemeColors } from '../utils/ColorUtils';
import ModernBannerHeader from './ModernBannerHeader';
import ModernPurposeCard from './ModernPurposeCard';
import ModernBannerFooter from './ModernBannerFooter';
import ModernBannerActions from './ModernBannerActions';

export interface BannerUIProps {
  banner: Banner;
  companyName: string;
  logoUrl?: string;
  onChangePurpose: (purposeId: string, status: 'accepted' | 'declined') => void;
  onRejectAll: () => void;
  onConsentAll: () => void;
  onAcceptSelected: () => void;
  onAcceptMandatory: () => void;
  hasUserInteracted?: boolean;
  /** Matches truKIT-NPM's BannerUI.jsx `isBottomReached` — whether the user
   * has scrolled through every purpose. Gates Reject All/Only Necessary/I
   * Consent until true, unless there's only a single optional purpose
   * (no scroll needed then). Defaults to `true` (no gating) for callers
   * that don't track scroll position. */
  isBottomReached?: boolean;
  onAcknowledgeNotice?: () => void;
  primaryColor?: string;
  secondaryColor?: string;
  uiState?: UIState;
  /** "Common Appearance" theme (background/text/button colors, font) from
   * the admin dashboard. Derived from `banner.banner_settings` if omitted. */
  theme?: BannerTheme;
  /** Translates dynamic (server-supplied) text via the banner's translation
   * snapshot — see utils/translationSnapshot.ts. Identity function if omitted. */
  translate?: (text: string) => string;
  selectedLanguage?: string;
  availableLanguages?: string[];
  languageLabels?: Record<string, string>;
  onLanguageChange?: (lang: string) => void;
}

export default function BannerUI({
  banner,
  companyName,
  logoUrl,
  onChangePurpose,
  onRejectAll,
  onConsentAll,
  onAcceptSelected,
  onAcceptMandatory,
  hasUserInteracted = false,
  isBottomReached = true,
  onAcknowledgeNotice,
  primaryColor,
  secondaryColor,
  uiState,
  theme: themeProp,
  translate = (text: string) => text || '',
  selectedLanguage = 'en',
  availableLanguages = [],
  languageLabels = {},
  onLanguageChange,
}: BannerUIProps) {
  const settings = banner?.banner_settings || {};
  const theme = themeProp ?? deriveBannerThemeColors(settings);
  // button_color must win over primary_color ("Background Color" — see
  // ColorUtils.ts's deriveBannerThemeColors) for the Accept All button,
  // matching truKIT-NPM's ModernBannerActions.jsx `buttonColor || primaryColor`
  // priority. theme.button already resolves that chain.
  const finalPrimaryColor = theme.button || primaryColor;
  const finalSecondaryColor = settings.secondary_color || secondaryColor || '#555';
  const footerText =
    settings.footer_text ||
    'Review our [Privacy Policy] and [Transparency Centre], [DPO Details]. Use the [Rights Centre] anytime to withdraw consent, delete data, name a nominee, or raise a grievance.';
  const bannerTitle = settings.banner_title;
  const disclaimerText = settings.disclaimer_text;
  const actionButtonText = settings.action_button_text || settings.accept_all_text || 'I Consent';
  const fontFamily = theme.fontFamily;

  const { t } = useTranslation();
  // For static UI microcopy (tab labels, group headers, empty states):
  // prefer the server-driven snapshot (covers every language the admin
  // actually configured, matching truKIT-NPM's translate() usage for this
  // exact same copy — see TabbedBannerUI.jsx's buildTabs), falling back to
  // the static i18next bundle (only covers en/hi/ta) so those two languages
  // keep working even with no snapshot.
  const tr = (text: string, i18nKey?: string): string => {
    const snapshotResult = translate(text);
    if (snapshotResult !== text) return snapshotResult;
    return i18nKey ? t(i18nKey) : text;
  };

  // Tab state for tabbed UI
  const [activeTab, setActiveTab] = useState<'informational' | 'consent'>('consent');

  const bannerCase = uiState?.bannerCase ?? BannerCase.NORMAL;
  const noticePurposes = (uiState?.noticePurposes ?? []) as NormalizedPurpose[];
  const consentPurposes = (uiState?.consentPurposes ?? banner?.purposes ?? []) as NormalizedPurpose[];
  const mandatoryConsentPurposes = (uiState?.mandatoryConsentPurposes ?? []) as NormalizedPurpose[];
  const optionalConsentPurposes = (uiState?.optionalConsentPurposes ?? []) as NormalizedPurpose[];

  // Group consent purposes
  const necessaryPurposes = consentPurposes.filter((p) => p.isMandatory && !p.isDynamic);
  const optionalRegularPurposes = consentPurposes.filter((p) => !p.isMandatory && !p.isDynamic);
  const profileBasedPurposes = consentPurposes.filter((p) => p.isDynamic);

  const renderPurposeGroup = (
    label: string,
    purposeList: NormalizedPurpose[],
    readOnly = false
  ) => {
    if (!purposeList || purposeList.length === 0) return null;
    const groupI18nKey =
      label === 'Necessary'
        ? 'necessary_group'
        : label === 'Optional'
        ? 'optional_group'
        : label === 'Profile Based'
        ? 'profile_based_group'
        : undefined;
    return (
      <View style={styles.purposeGroup}>
        <Text style={[styles.purposeGroupLabel, { color: theme.textMuted, fontFamily }]}>
          {tr(label, groupI18nKey)}
        </Text>
        {purposeList.map((p, index) => (
          <View key={p.id} style={index > 0 ? { marginTop: 12 } : undefined}>
            <ModernPurposeCard
              purpose={p as Purpose}
              banner={banner}
              onToggle={readOnly ? undefined : onChangePurpose}
              theme={theme}
             translate={translate}
            />
          </View>
        ))}
      </View>
    );
  };

  // NOTICE_ONLY case
  if (bannerCase === BannerCase.NOTICE_ONLY) {
    const allPurposes = noticePurposes.length > 0 ? noticePurposes : (banner.purposes as NormalizedPurpose[]);
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ModernBannerHeader
          logoUrl={settings.logo_url || logoUrl}
          orgName={companyName}
          bannerTitle={bannerTitle}
          disclaimerText={disclaimerText}
          theme={theme}
          translate={translate}
          selectedLanguage={selectedLanguage}
          availableLanguages={availableLanguages}
          languageLabels={languageLabels}
          onLanguageChange={onLanguageChange}
        />
        <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
          <View style={[styles.tabButton, styles.tabButtonActive, { borderBottomColor: finalPrimaryColor }]}>
            <Text style={[styles.tabText, { color: finalPrimaryColor, fontFamily }]}>{tr('Informational', 'informational')}</Text>
          </View>
        </View>
        <View style={styles.purposesContainer}>
          {allPurposes.map((p, index) => (
            <View key={p.id} style={index > 0 ? { marginTop: 12 } : undefined}>
              <ModernPurposeCard
                purpose={p as Purpose}
                banner={banner}
                onToggle={undefined}
                theme={theme}
               translate={translate}
              />
            </View>
          ))}
        </View>
        <View style={styles.footerWrapper}>
          <ModernBannerFooter footerText={footerText} orgName={companyName} theme={theme} translate={translate} />
          <TouchableOpacity
            style={[styles.iUnderstandButton, { backgroundColor: finalPrimaryColor }]}
            onPress={onAcknowledgeNotice}
          >
            <Text style={[styles.iUnderstandButtonText, { color: theme.buttonText, fontFamily }]}>
              {actionButtonText === 'I Consent' ? 'I Understand' : actionButtonText}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // TABBED case
  if (bannerCase === BannerCase.TABBED) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ModernBannerHeader
          logoUrl={settings.logo_url || logoUrl}
          orgName={companyName}
          bannerTitle={bannerTitle}
          disclaimerText={disclaimerText}
          theme={theme}
          translate={translate}
          selectedLanguage={selectedLanguage}
          availableLanguages={availableLanguages}
          languageLabels={languageLabels}
          onLanguageChange={onLanguageChange}
        />

        {/* Tab bar */}
        <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'informational' && [styles.tabButtonActive, { borderBottomColor: finalPrimaryColor }],
            ]}
            onPress={() => setActiveTab('informational')}
          >
            <Text
              style={[
                styles.tabText,
                { fontFamily },
                activeTab === 'informational' ? { color: finalPrimaryColor } : { color: theme.textMuted },
              ]}
            >
              {tr('Informational', 'informational')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'consent' && [styles.tabButtonActive, { borderBottomColor: finalPrimaryColor }],
            ]}
            onPress={() => setActiveTab('consent')}
          >
            <Text
              style={[
                styles.tabText,
                { fontFamily },
                activeTab === 'consent' ? { color: finalPrimaryColor } : { color: theme.textMuted },
              ]}
            >
              {tr('Consent', 'consent')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab content */}
        {activeTab === 'informational' ? (
          <View style={styles.purposesContainer}>
            {noticePurposes.map((p, index) => (
              <View key={p.id} style={index > 0 ? { marginTop: 12 } : undefined}>
                <ModernPurposeCard
                  purpose={p as Purpose}
                  banner={banner}
                  onToggle={undefined}
                  theme={theme}
                 translate={translate}
                />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.purposesContainer}>
            {renderPurposeGroup('Necessary', necessaryPurposes)}
            {renderPurposeGroup('Optional', optionalRegularPurposes)}
            {renderPurposeGroup('Profile Based', profileBasedPurposes)}
            {consentPurposes.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyStateText, { color: theme.textMuted, fontFamily }]}>
                  {tr('No consent purposes available', 'no_consent_purposes')}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.footerWrapper}>
          <ModernBannerFooter footerText={footerText} orgName={companyName} theme={theme} translate={translate} />
          {/* Matches truKIT-NPM's TabbedBannerUI.jsx: the Informational tab only ever
           * advances to the Consent tab via "Next" — the actual accept/reject/only-
           * necessary decision is made on the Consent tab, which is where the real
           * action buttons belong. */}
          {activeTab === 'informational' ? (
            <TouchableOpacity
              style={[styles.iUnderstandButton, { backgroundColor: finalPrimaryColor }]}
              onPress={() => setActiveTab('consent')}
            >
              <Text style={[styles.iUnderstandButtonText, { color: theme.buttonText, fontFamily }]}>
                {tr('Next', 'next')}
              </Text>
            </TouchableOpacity>
          ) : (
            <ModernBannerActions
              onRejectAll={onRejectAll}
              onConsentAll={onConsentAll}
              onAcceptSelected={onAcceptSelected}
              onAcceptMandatory={onAcceptMandatory}
              hasUserInteracted={hasUserInteracted}
              isBottomReached={isBottomReached}
              purposes={banner?.purposes || []}
              actionButtonText={actionButtonText}
              primaryColor={finalPrimaryColor}
              theme={theme}
              rejectAllColor={settings.reject_all_color}
              rejectAllText={settings.reject_all_text}
              onlyNecessaryColor={settings.only_necessary_color}
              onlyNecessaryText={settings.only_necessary_text}
              translate={translate}
            />
          )}
        </View>
      </View>
    );
  }

  // NORMAL case (default)
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ModernBannerHeader
        logoUrl={settings.logo_url || logoUrl}
        orgName={companyName}
        bannerTitle={bannerTitle}
        disclaimerText={disclaimerText}
        theme={theme}
        translate={translate}
        selectedLanguage={selectedLanguage}
        availableLanguages={availableLanguages}
        languageLabels={languageLabels}
        onLanguageChange={onLanguageChange}
      />

      <View style={styles.purposesContainer}>
        {banner?.purposes && banner.purposes.length > 0 ? (
          <>
            {renderPurposeGroup('Necessary', necessaryPurposes)}
            {renderPurposeGroup('Optional', optionalRegularPurposes)}
            {renderPurposeGroup('Profile Based', profileBasedPurposes)}
            {necessaryPurposes.length === 0 &&
              optionalRegularPurposes.length === 0 &&
              profileBasedPurposes.length === 0 &&
              banner.purposes.map((p, index) => (
                <View key={p.id} style={index > 0 ? { marginTop: 16 } : undefined}>
                  <ModernPurposeCard
                    purpose={p}
                    banner={banner}
                    onToggle={onChangePurpose}
                    theme={theme}
                   translate={translate}
                  />
                </View>
              ))}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, { color: theme.textMuted, fontFamily }]}>
              {tr('No purposes available', 'no_purposes_available')}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.footerWrapper}>
        <ModernBannerFooter footerText={footerText} orgName={companyName} theme={theme} translate={translate} />
        <ModernBannerActions
          onRejectAll={onRejectAll}
          onConsentAll={onConsentAll}
          onAcceptSelected={onAcceptSelected}
          onAcceptMandatory={onAcceptMandatory}
          hasUserInteracted={hasUserInteracted}
          isBottomReached={isBottomReached}
          purposes={banner?.purposes || []}
          actionButtonText={actionButtonText}
          primaryColor={finalPrimaryColor}
          theme={theme}
          rejectAllColor={settings.reject_all_color}
          rejectAllText={settings.reject_all_text}
          onlyNecessaryColor={settings.only_necessary_color}
          onlyNecessaryText={settings.only_necessary_text}
          translate={translate}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    overflow: 'visible',
    width: '100%',
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginHorizontal: 16,
    marginTop: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextInactive: {
    color: '#9ca3af',
  },
  purposesContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  purposeGroup: {
    marginBottom: 16,
  },
  purposeGroupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  footerWrapper: {
    marginTop: 8,
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  iUnderstandButton: {
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  iUnderstandButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
