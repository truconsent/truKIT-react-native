/**
 * InlineSingleRowUI - `inline_single_row` banner template.
 *
 * One row per purpose with all its detail (description, data elements,
 * data processors, expiry, toggle) visible at once — no expand/collapse,
 * unlike CompactListUI. Mirrors the NPM SDK's `InlineSingleRowUI.jsx` (a
 * spreadsheet/table-like layout). Renders nothing if there are no purposes,
 * matching the NPM behavior.
 */
import React from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { Banner, Purpose } from '../core/types';
import ModernBannerHeader from './ModernBannerHeader';
import ModernBannerFooter from './ModernBannerFooter';
import ModernBannerActions from './ModernBannerActions';

export interface InlineSingleRowUIProps {
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

function InlineRow({
  purpose,
  onChangePurpose,
}: {
  purpose: Purpose;
  onChangePurpose: (purposeId: string, status: 'accepted' | 'declined') => void;
}) {
  const dataElements = purpose.data_elements || [];
  const processors = [...(purpose.legal_entities || []), ...(purpose.tools || [])];
  const expiryText = purpose.expiry_label || purpose.expiry_period || '—';

  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <View style={styles.rowTitleWrap}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {purpose.name}
            </Text>
            {purpose.is_mandatory && (
              <View style={styles.mandatoryBadge}>
                <Text style={styles.mandatoryBadgeText}>Mandatory</Text>
              </View>
            )}
          </View>
          <Text style={styles.rowDescription}>{purpose.description}</Text>
        </View>
        {!purpose.is_mandatory && !purpose.is_legitimate && (
          <Switch
            value={purpose.consented === 'accepted'}
            onValueChange={(value) => onChangePurpose(purpose.id, value ? 'accepted' : 'declined')}
          />
        )}
      </View>
      <View style={styles.rowColumns}>
        {dataElements.length > 0 && (
          <View style={styles.rowColumn}>
            <Text style={styles.rowColumnLabel}>Data Elements</Text>
            <Text style={styles.rowColumnValue}>{dataElements.map((e) => e.name).join(', ')}</Text>
          </View>
        )}
        {processors.length > 0 && (
          <View style={styles.rowColumn}>
            <Text style={styles.rowColumnLabel}>Data Processors</Text>
            <Text style={styles.rowColumnValue}>{processors.map((e) => e.name).join(', ')}</Text>
          </View>
        )}
        <View style={styles.rowColumn}>
          <Text style={styles.rowColumnLabel}>Expiry</Text>
          <Text style={styles.rowColumnValue}>{expiryText}</Text>
        </View>
      </View>
    </View>
  );
}

export default function InlineSingleRowUI({
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
}: InlineSingleRowUIProps) {
  const purposes = banner?.purposes || [];
  if (purposes.length === 0) return null;

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
        {purposes.map((p) => (
          <InlineRow key={p.id} purpose={p} onChangePurpose={onChangePurpose} />
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
    padding: 12,
    marginBottom: 12,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  rowTitleWrap: {
    flex: 1,
    marginRight: 8,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
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
  rowDescription: {
    fontSize: 12,
    color: '#374151',
    marginTop: 4,
  },
  rowColumns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  rowColumn: {
    minWidth: 110,
    maxWidth: 220,
    marginRight: 16,
    marginBottom: 6,
  },
  rowColumnLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 0.4,
  },
  rowColumnValue: {
    fontSize: 12,
    color: '#111827',
    marginTop: 2,
  },
});
