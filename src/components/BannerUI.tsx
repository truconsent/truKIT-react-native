/**
 * BannerUI - React Native banner UI component with tabbed UI support
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Banner, Purpose } from '../core/types';
import { UIState, BannerCase, NormalizedPurpose } from '../core/ConsentManager';
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
  onAcknowledgeNotice?: () => void;
  primaryColor?: string;
  secondaryColor?: string;
  uiState?: UIState;
}

export default function BannerUI({
  banner,
  companyName,
  logoUrl,
  onChangePurpose,
  onRejectAll,
  onConsentAll,
  onAcceptSelected,
  onAcknowledgeNotice,
  primaryColor,
  secondaryColor,
  uiState,
}: BannerUIProps) {
  const settings = banner?.banner_settings || {};
  const finalPrimaryColor = settings.primary_color || primaryColor || '#3b82f6';
  const finalSecondaryColor = settings.secondary_color || secondaryColor || '#555';
  const footerText =
    settings.footer_text ||
    'Review our [Privacy Policy] and [Transparency Centre], [DPO Details]. Use the [Rights Centre] anytime to withdraw consent, delete data, name a nominee, or raise a grievance.';
  const bannerTitle = settings.banner_title;
  const disclaimerText = settings.disclaimer_text;
  const actionButtonText = settings.action_button_text || 'I Consent';

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
    return (
      <View style={styles.purposeGroup}>
        <Text style={styles.purposeGroupLabel}>{label}</Text>
        {purposeList.map((p, index) => (
          <View key={p.id} style={index > 0 ? { marginTop: 12 } : undefined}>
            <ModernPurposeCard
              purpose={p as Purpose}
              banner={banner}
              onToggle={readOnly ? undefined : onChangePurpose}
            />
          </View>
        ))}
      </View>
    );
  };

  console.log('BannerUI rendering with:', {
    purposesCount: banner?.purposes?.length || 0,
    companyName,
    bannerCase,
    hasSettings: !!banner?.banner_settings,
  });

  // NOTICE_ONLY case
  if (bannerCase === BannerCase.NOTICE_ONLY) {
    const allPurposes = noticePurposes.length > 0 ? noticePurposes : (banner.purposes as NormalizedPurpose[]);
    return (
      <View style={styles.container}>
        <ModernBannerHeader
          logoUrl={settings.logo_url || logoUrl}
          orgName={companyName}
          bannerTitle={bannerTitle}
          disclaimerText={disclaimerText}
        />
        <View style={styles.tabBar}>
          <View style={[styles.tabButton, styles.tabButtonActive, { borderBottomColor: finalPrimaryColor }]}>
            <Text style={[styles.tabText, { color: finalPrimaryColor }]}>Informational</Text>
          </View>
        </View>
        <View style={styles.purposesContainer}>
          {allPurposes.map((p, index) => (
            <View key={p.id} style={index > 0 ? { marginTop: 12 } : undefined}>
              <ModernPurposeCard
                purpose={p as Purpose}
                banner={banner}
                onToggle={undefined}
              />
            </View>
          ))}
        </View>
        <View style={styles.footerWrapper}>
          <ModernBannerFooter footerText={footerText} orgName={companyName} />
          <TouchableOpacity
            style={[styles.iUnderstandButton, { backgroundColor: finalPrimaryColor }]}
            onPress={onAcknowledgeNotice}
          >
            <Text style={styles.iUnderstandButtonText}>
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
      <View style={styles.container}>
        <ModernBannerHeader
          logoUrl={settings.logo_url || logoUrl}
          orgName={companyName}
          bannerTitle={bannerTitle}
          disclaimerText={disclaimerText}
        />

        {/* Tab bar */}
        <View style={styles.tabBar}>
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
                activeTab === 'informational' ? { color: finalPrimaryColor } : styles.tabTextInactive,
              ]}
            >
              Informational
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
                activeTab === 'consent' ? { color: finalPrimaryColor } : styles.tabTextInactive,
              ]}
            >
              Consent
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
                <Text style={styles.emptyStateText}>No consent purposes available</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.footerWrapper}>
          <ModernBannerFooter footerText={footerText} orgName={companyName} />
          <ModernBannerActions
            onRejectAll={onRejectAll}
            onConsentAll={onConsentAll}
            onAcceptSelected={onAcceptSelected}
            purposes={banner?.purposes || []}
            actionButtonText={actionButtonText}
            primaryColor={finalPrimaryColor}
          />
        </View>
      </View>
    );
  }

  // NORMAL case (default)
  return (
    <View style={styles.container}>
      <ModernBannerHeader
        logoUrl={settings.logo_url || logoUrl}
        orgName={companyName}
        bannerTitle={bannerTitle}
        disclaimerText={disclaimerText}
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
                  />
                </View>
              ))}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No purposes available</Text>
          </View>
        )}
      </View>

      <View style={styles.footerWrapper}>
        <ModernBannerFooter footerText={footerText} orgName={companyName} />
        <ModernBannerActions
          onRejectAll={onRejectAll}
          onConsentAll={onConsentAll}
          onAcceptSelected={onAcceptSelected}
          purposes={banner?.purposes || []}
          actionButtonText={actionButtonText}
          primaryColor={finalPrimaryColor}
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
