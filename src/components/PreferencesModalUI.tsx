/**
 * PreferencesModalUI - `preferences_modal` banner template.
 *
 * A simple stacked purpose-card list with three actions: "Only Necessary",
 * "Save My Preferences", and "Accept All". Unlike BannerUI's action bar,
 * this template has no "Reject All" button (mirrors the NPM SDK's
 * `PreferencesModalUI.jsx`, which intentionally omits it).
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Banner } from '../core/types';
import ModernBannerHeader from './ModernBannerHeader';
import ModernBannerFooter from './ModernBannerFooter';
import ModernPurposeCard from './ModernPurposeCard';

export interface PreferencesModalUIProps {
  banner: Banner;
  companyName: string;
  logoUrl?: string;
  onChangePurpose: (purposeId: string, status: 'accepted' | 'declined') => void;
  onAcceptMandatory: () => void;
  onAcceptSelected: () => void;
  onConsentAll: () => void;
  primaryColor?: string;
}

export default function PreferencesModalUI({
  banner,
  companyName,
  logoUrl,
  onChangePurpose,
  onAcceptMandatory,
  onAcceptSelected,
  onConsentAll,
  primaryColor,
}: PreferencesModalUIProps) {
  const settings = banner?.banner_settings || ({} as any);
  const finalPrimaryColor = settings.primary_color || primaryColor || '#3b82f6';
  const footerText =
    settings.footer_text ||
    'Review our [Privacy Policy] and [Transparency Centre], [DPO Details]. Use the [Rights Centre] anytime to withdraw consent, delete data, name a nominee, or raise a grievance.';

  return (
    <View style={styles.container}>
      <ModernBannerHeader
        logoUrl={settings.logo_url || logoUrl}
        orgName={companyName}
        bannerTitle={settings.banner_title}
        disclaimerText={settings.disclaimer_text}
      />
      <View style={styles.purposesContainer}>
        {(banner?.purposes || []).map((p, index) => (
          <View key={p.id} style={index > 0 ? { marginTop: 12 } : undefined}>
            <ModernPurposeCard purpose={p} banner={banner} onToggle={onChangePurpose} />
          </View>
        ))}
      </View>
      <View style={styles.footerWrapper}>
        <ModernBannerFooter footerText={footerText} orgName={companyName} />
        <View style={styles.actions}>
          <TouchableOpacity style={styles.outlineButton} onPress={onAcceptMandatory}>
            <Text style={styles.outlineButtonText}>Accept Only Necessary</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.outlineButton, { borderColor: finalPrimaryColor, marginTop: 10 }]}
            onPress={onAcceptSelected}
          >
            <Text style={[styles.outlineButtonText, { color: finalPrimaryColor }]}>
              Save My Preferences
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.solidButton, { backgroundColor: finalPrimaryColor, marginTop: 10 }]}
            onPress={onConsentAll}
          >
            <Text style={styles.solidButtonText}>Accept All</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    width: '100%',
    flex: 1,
  },
  purposesContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  footerWrapper: {
    padding: 16,
    paddingTop: 8,
  },
  actions: {
    marginTop: 12,
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },
  outlineButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  solidButton: {
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },
  solidButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
