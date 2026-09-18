/**
 * CompactListUI - `general_compact_list` banner template.
 *
 * Accordion-style rows: one collapsed row per purpose (name, mandatory
 * badge, toggle), expanding to reveal description and Data
 * Elements/Data Processors detail sections. Mirrors the NPM SDK's
 * `CompactListUI.jsx`.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Banner, Purpose } from '../core/types';
import ModernBannerHeader from './ModernBannerHeader';
import ModernBannerFooter from './ModernBannerFooter';
import ModernBannerActions from './ModernBannerActions';
import CollapsibleDataSection from './CollapsibleDataSection';

export interface CompactListUIProps {
  banner: Banner;
  companyName: string;
  logoUrl?: string;
  onChangePurpose: (purposeId: string, status: 'accepted' | 'declined') => void;
  onRejectAll: () => void;
  onConsentAll: () => void;
  onAcceptSelected: () => void;
  primaryColor?: string;
}

function CompactPurposeRow({
  purpose,
  onToggle,
}: {
  purpose: Purpose;
  onToggle: (purposeId: string, status: 'accepted' | 'declined') => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isAccepted = purpose.consented === 'accepted';
  const dataElements = purpose.data_elements || [];
  const processors = [...(purpose.legal_entities || []), ...(purpose.tools || [])];

  return (
    <View style={styles.row}>
      <TouchableOpacity style={styles.rowHeader} onPress={() => setExpanded((v) => !v)}>
        <View style={styles.rowTitleWrap}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {purpose.name}
          </Text>
          {purpose.is_mandatory && (
            <View style={styles.mandatoryBadge}>
              <Text style={styles.mandatoryBadgeText}>Mandatory</Text>
            </View>
          )}
        </View>
        {!purpose.is_mandatory && !purpose.is_legitimate && (
          <Switch
            value={isAccepted}
            onValueChange={(value) => onToggle(purpose.id, value ? 'accepted' : 'declined')}
          />
        )}
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {expanded && (
        <View style={styles.rowBody}>
          <Text style={styles.rowDescription}>{purpose.description}</Text>
          {dataElements.length > 0 && (
            <CollapsibleDataSection
              title="Data Elements"
              items={dataElements}
              isOpen={true}
              onToggle={() => {}}
            />
          )}
          {processors.length > 0 && (
            <CollapsibleDataSection
              title="Data Processors"
              items={processors}
              isOpen={true}
              onToggle={() => {}}
            />
          )}
        </View>
      )}
    </View>
  );
}

export default function CompactListUI({
  banner,
  companyName,
  logoUrl,
  onChangePurpose,
  onRejectAll,
  onConsentAll,
  onAcceptSelected,
  primaryColor,
}: CompactListUIProps) {
  const settings = banner?.banner_settings || ({} as any);
  const actionButtonText = settings.action_button_text || 'Accept All';
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
        {(banner?.purposes || []).map((p) => (
          <CompactPurposeRow key={p.id} purpose={p} onToggle={onChangePurpose} />
        ))}
      </View>
      <View style={styles.footerWrapper}>
        <ModernBannerFooter footerText={footerText} orgName={companyName} />
        <ModernBannerActions
          onRejectAll={onRejectAll}
          onConsentAll={onConsentAll}
          onAcceptSelected={onAcceptSelected}
          purposes={banner?.purposes || []}
          actionButtonText={actionButtonText}
          primaryColor={settings.primary_color || primaryColor}
        />
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
  row: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    marginBottom: 10,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flexShrink: 1,
  },
  mandatoryBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#fee2e2',
  },
  mandatoryBadgeText: {
    fontSize: 9,
    color: '#b91c1c',
  },
  chevron: {
    marginLeft: 8,
    color: '#6b7280',
  },
  rowBody: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  rowDescription: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 8,
  },
});
