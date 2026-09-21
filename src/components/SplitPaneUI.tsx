/**
 * SplitPaneUI - `general_split_pane` banner template.
 *
 * A selectable list of purposes on one side and a detail pane (description,
 * processing activities, data elements/processors) for the active purpose
 * on the other. On narrow screens the detail pane renders below the list
 * instead of beside it. Mirrors the NPM SDK's `SplitPaneUI.jsx`.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Banner, Purpose } from '../core/types';
import ModernBannerHeader from './ModernBannerHeader';
import ModernBannerFooter from './ModernBannerFooter';
import ModernBannerActions from './ModernBannerActions';

export interface SplitPaneUIProps {
  banner: Banner;
  companyName: string;
  logoUrl?: string;
  onChangePurpose: (purposeId: string, status: 'accepted' | 'declined') => void;
  onRejectAll: () => void;
  onConsentAll: () => void;
  onAcceptSelected: () => void;
  onAcceptMandatory: () => void;
  hasUserInteracted?: boolean;
  primaryColor?: string;
}

export default function SplitPaneUI({
  banner,
  companyName,
  logoUrl,
  onChangePurpose,
  onRejectAll,
  onConsentAll,
  onAcceptSelected,
  onAcceptMandatory,
  hasUserInteracted = false,
  primaryColor,
}: SplitPaneUIProps) {
  const purposes = banner?.purposes || [];
  const [activeId, setActiveId] = useState<string | undefined>(purposes[0]?.id);
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const settings = banner?.banner_settings || ({} as any);
  const actionButtonText = settings.action_button_text || 'Accept All';
  const footerText =
    settings.footer_text ||
    'Review our [Privacy Policy] and [Transparency Centre], [DPO Details]. Use the [Rights Centre] anytime to withdraw consent, delete data, name a nominee, or raise a grievance.';

  const activePurpose = purposes.find((p) => p.id === activeId) || purposes[0];

  const list = (
    <View style={isMobile ? undefined : styles.listColumn}>
      {purposes.map((p) => {
        const isActive = p.id === (activeId ?? purposes[0]?.id);
        return (
          <TouchableOpacity
            key={p.id}
            style={[styles.listItem, isActive && styles.listItemActive]}
            onPress={() => setActiveId(p.id)}
          >
            <Text style={[styles.listItemText, isActive && styles.listItemTextActive]} numberOfLines={1}>
              {p.name}
            </Text>
            {p.is_mandatory && (
              <View style={styles.mandatoryBadge}>
                <Text style={styles.mandatoryBadgeText}>Mandatory</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const detail = activePurpose ? (
    <PurposeDetail purpose={activePurpose} onChangePurpose={onChangePurpose} />
  ) : null;

  return (
    <View style={styles.container}>
      <ModernBannerHeader
        logoUrl={settings.logo_url || logoUrl}
        orgName={companyName}
        bannerTitle={settings.banner_title}
        disclaimerText={settings.disclaimer_text}
      />
      <View style={styles.purposesContainer}>
        {purposes.length > 0 &&
          (isMobile ? (
            <View>
              {list}
              <View style={{ marginTop: 16 }}>{detail}</View>
            </View>
          ) : (
            <View style={styles.splitRow}>
              {list}
              <View style={styles.detailColumn}>{detail}</View>
            </View>
          ))}
      </View>
      <View style={styles.footerWrapper}>
        <ModernBannerFooter footerText={footerText} orgName={companyName} />
        <ModernBannerActions
          onRejectAll={onRejectAll}
          onConsentAll={onConsentAll}
          onAcceptSelected={onAcceptSelected}
          onAcceptMandatory={onAcceptMandatory}
          hasUserInteracted={hasUserInteracted}
          purposes={purposes}
          actionButtonText={actionButtonText}
          primaryColor={settings.primary_color || primaryColor}
        />
      </View>
    </View>
  );
}

function PurposeDetail({
  purpose,
  onChangePurpose,
}: {
  purpose: Purpose;
  onChangePurpose: (purposeId: string, status: 'accepted' | 'declined') => void;
}) {
  const dataElements = purpose.data_elements || [];
  const processors = [...(purpose.legal_entities || []), ...(purpose.tools || [])];
  const processingActivities = purpose.processing_activities || [];

  return (
    <View>
      <Text style={styles.detailTitle}>{purpose.name}</Text>
      <Text style={styles.detailDescription}>{purpose.description}</Text>
      {processingActivities.length > 0 && (
        <View style={styles.detailSection}>
          <Text style={styles.detailSectionTitle}>Processing Activities</Text>
          {processingActivities.map((a) => (
            <Text key={a.id} style={styles.detailListItem}>
              {'• '}
              {a.name}
            </Text>
          ))}
        </View>
      )}
      {dataElements.length > 0 && (
        <View style={styles.detailSection}>
          <Text style={styles.detailSectionTitle}>Data Elements</Text>
          <Text style={styles.detailChips}>{dataElements.map((e) => e.name).join(', ')}</Text>
        </View>
      )}
      {processors.length > 0 && (
        <View style={styles.detailSection}>
          <Text style={styles.detailSectionTitle}>Data Processors</Text>
          <Text style={styles.detailChips}>{processors.map((e) => e.name).join(', ')}</Text>
        </View>
      )}
      {!purpose.is_mandatory && !purpose.is_legitimate && (
        <TouchableOpacity
          style={styles.toggleRow}
          onPress={() =>
            onChangePurpose(purpose.id, purpose.consented === 'accepted' ? 'declined' : 'accepted')
          }
        >
          <Text style={styles.toggleRowText}>
            {purpose.consented === 'accepted' ? 'Accepted — tap to decline' : 'Declined — tap to accept'}
          </Text>
        </TouchableOpacity>
      )}
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
  splitRow: {
    flexDirection: 'row',
  },
  listColumn: {
    width: 180,
    marginRight: 16,
  },
  detailColumn: {
    flex: 1,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 6,
  },
  listItemActive: {
    backgroundColor: '#f3f4f6',
    borderColor: '#9ca3af',
  },
  listItemText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
    flexShrink: 1,
  },
  listItemTextActive: {
    fontWeight: '700',
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
  detailTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  detailDescription: {
    fontSize: 13,
    color: '#374151',
    marginTop: 6,
  },
  detailSection: {
    marginTop: 12,
  },
  detailSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  detailListItem: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 2,
  },
  detailChips: {
    fontSize: 13,
    color: '#374151',
  },
  toggleRow: {
    marginTop: 16,
    paddingVertical: 10,
  },
  toggleRowText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
  },
});
