/**
 * NoticeOnlyBanner - `notice_only` banner template.
 *
 * Renders every purpose as a read-only card (no toggles) with a single
 * "I Understand" acknowledgement button. Unlike BannerUI's notice-only case
 * (which is derived from purpose composition), selecting this template
 * forces the read-only/acknowledge-only presentation regardless of what
 * purposes are present, mirroring the NPM SDK's dedicated
 * `NoticeOnlyBanner.jsx` component.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Banner } from '../core/types';
import ModernBannerHeader from './ModernBannerHeader';
import ModernBannerFooter from './ModernBannerFooter';
import ModernPurposeCard from './ModernPurposeCard';

export interface NoticeOnlyBannerProps {
  banner: Banner;
  companyName: string;
  logoUrl?: string;
  onAcknowledge: () => void;
  primaryColor?: string;
}

export default function NoticeOnlyBanner({
  banner,
  companyName,
  logoUrl,
  onAcknowledge,
  primaryColor,
}: NoticeOnlyBannerProps) {
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
            <ModernPurposeCard purpose={p} banner={banner} onToggle={undefined} />
          </View>
        ))}
      </View>
      <View style={styles.footerWrapper}>
        <ModernBannerFooter footerText={footerText} orgName={companyName} />
        <TouchableOpacity
          style={[styles.acknowledgeButton, { backgroundColor: finalPrimaryColor }]}
          onPress={onAcknowledge}
        >
          <Text style={styles.acknowledgeButtonText}>I Understand</Text>
        </TouchableOpacity>
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
  acknowledgeButton: {
    marginTop: 12,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  acknowledgeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
