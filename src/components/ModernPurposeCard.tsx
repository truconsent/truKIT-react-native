/**
 * ModernPurposeCard - React Native purpose card component
 */
import React, { useState } from 'react';
import { View, Text, Switch, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Purpose, Banner } from '../core/types';
import { BannerTheme } from '../utils/ColorUtils';
import CollapsibleDataSection from './CollapsibleDataSection';

// Fallback for a handful of known purpose/data-element names when no
// server-driven translation snapshot is available at all. The snapshot
// (via the `translate` prop) is the real, general mechanism — this only
// covers what it was hardcoded for historically.
const dynamicTranslations: Record<string, Record<string, string>> = {
  ta: {
    'User Authentication & Management': 'பயனர் அங்கீகாரம் மற்றும் மேலாண்மை',
    'Account creation and access management': 'கணக்கு உருவாக்கம் மற்றும் அணுகல் மேலாண்மை',
    'Notifications & Updates': 'அறிவிப்புகள் மற்றும் புதுப்பிப்புகள்',
    'Transactional and service-related updates': 'பரிவர்த்தனை மற்றும் சேவை தொடர்பான புதுப்பிப்புகள்',
  },
  hi: {
    'User Authentication & Management': 'उपयोगकर्ता प्रमाणीकरण और प्रबंधन',
    'Account creation and access management': 'खाता निर्माण और पहुंच प्रबंधन',
    'Notifications & Updates': 'सूचनाएं और अपडेट',
    'Transactional and service-related updates': 'लेन-देन और सेवा-संबंधी अपडेट',
  },
};

const translateDynamic = (text: string, language: string): string => {
  if (dynamicTranslations[language] && dynamicTranslations[language][text]) {
    return dynamicTranslations[language][text];
  }
  return text;
};

export interface ModernPurposeCardProps {
  purpose: Purpose;
  banner: Banner;
  onToggle?: (purposeId: string, status: 'accepted' | 'declined') => void;
  theme?: BannerTheme;
  /** Translates dynamic (server-supplied) text via the banner's translation
   * snapshot. Falls back to the small hardcoded dict above, then to the
   * original text, if the snapshot has no match. */
  translate?: (text: string) => string;
}

export default function ModernPurposeCard({
  purpose,
  banner,
  onToggle,
  theme,
  translate,
}: ModernPurposeCardProps) {
  const { t, i18n } = useTranslation();
  const [openSection, setOpenSection] = useState<string | null>(null);
  const isMandatory = purpose.is_mandatory;
  const isAccepted = purpose.consented === 'accepted' || (purpose.consented as any) === true;
  const expiryLabel = purpose.expiry_label || purpose.expiry_period || '1 Year';

  const localize = (text: string): string => {
    const snapshotResult = translate ? translate(text) : text;
    if (snapshotResult !== text) return snapshotResult;
    return translateDynamic(text, i18n.language);
  };

  // For static UI microcopy (badges, section titles): prefer the
  // server-driven snapshot (covers every language the admin actually
  // configured, matching truKIT-NPM's translateDynamic usage for this exact
  // same copy), falling back to the static i18next bundle (only covers
  // en/hi/ta) so those two languages keep working even with no snapshot.
  const tr = (text: string, i18nKey?: string): string => {
    const snapshotResult = translate ? translate(text) : text;
    if (snapshotResult !== text) return snapshotResult;
    return i18nKey ? t(i18nKey) : text;
  };

  const handleToggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  const dataElements = purpose.data_elements || [];
  const processingActivities = purpose.processing_activities || [];
  const legalEntities = purpose.legal_entities || [];
  const tools = purpose.tools || [];

  const cardBg = theme?.background ?? '#fff';
  const textColor = theme?.text ?? '#111827';
  const mutedColor = theme?.textMuted ?? '#6b7280';
  const borderColor = theme?.border ?? '#e5e7eb';
  const fontFamily = theme?.fontFamily;

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: textColor, fontFamily }]}>{localize(purpose.name)}</Text>
            {isMandatory && (
              <View style={styles.mandatoryBadge}>
                <Text style={[styles.mandatoryText, { fontFamily }]}>
                  {tr('Necessary', 'necessary_group')}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.description, { color: mutedColor, fontFamily }]}>
            {localize(purpose.description)}
          </Text>
        </View>
        <View style={styles.actions}>
          <View style={styles.expiryBadge}>
            <Text style={[styles.expiryText, { fontFamily }]}>{t('expiry_type', { expiry: expiryLabel })}</Text>
          </View>
          <View style={styles.switchContainer}>
            <Text style={[styles.switchLabel, { fontFamily }, isAccepted && styles.switchLabelActive]}>
              {tr('Accept', 'accept')}
            </Text>
            <View style={{ width: 8 }} />
            <Switch
              value={isAccepted}
              onValueChange={(value) => onToggle && onToggle(purpose.id, value ? 'accepted' : 'declined')}
              disabled={!onToggle}
              trackColor={{ false: '#d1d5db', true: theme?.button ?? '#3b82f6' }}
              thumbColor={isAccepted ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>
      </View>

      {dataElements.length > 0 && (
        <CollapsibleDataSection
          title={tr('Data Elements', 'data_elements')}
          items={dataElements}
          isOpen={openSection === 'data_elements'}
          onToggle={() => handleToggleSection('data_elements')}
          translate={translate}
          theme={theme}
        />
      )}

      {banner?.show_processors !== false && (legalEntities.length > 0 || tools.length > 0) && (
        <View style={[styles.section, { borderTopColor: borderColor }]}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => handleToggleSection('data_processors')}
          >
            <Text style={[styles.sectionTitle, { color: mutedColor, fontFamily }]}>
              {tr('Data Processors', 'data_processors')}
            </Text>
            <Text style={[styles.chevron, { color: mutedColor }]}>
              {openSection === 'data_processors' ? '▼' : '▶'}
            </Text>
          </TouchableOpacity>
          {openSection === 'data_processors' && (
            <View style={styles.sectionContent}>
              {legalEntities.length > 0 && (
                <View style={styles.subsection}>
                  <Text style={[styles.subsectionTitle, { color: mutedColor, fontFamily }]}>
                    {tr('Legal Entities', 'legal_entities')} ({legalEntities.length})
                  </Text>
                  <View style={styles.pillsContainer}>
                    {legalEntities.map((item) => (
                      <View key={item.id} style={[styles.pill, { backgroundColor: cardBg, borderColor }]}>
                        <Text style={[styles.pillText, { color: textColor, fontFamily }]}>
                          {localize(item.name)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
              {tools.length > 0 && (
                <View style={styles.subsection}>
                  <Text style={[styles.subsectionTitle, { color: mutedColor, fontFamily }]}>
                    {tr('Tools', 'tools')} ({tools.length})
                  </Text>
                  <View style={styles.pillsContainer}>
                    {tools.map((item, index) => (
                      <View
                        key={item.id}
                        style={[
                          styles.pill,
                          { backgroundColor: cardBg, borderColor },
                          index > 0 && { marginLeft: 8, marginTop: 8 },
                        ]}
                      >
                        <Text style={[styles.pillText, { color: textColor, fontFamily }]}>
                          {localize(item.name)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {processingActivities.length > 0 && (
        <CollapsibleDataSection
          title={tr('Processing Activities', 'processing_activities')}
          items={processingActivities}
          isOpen={openSection === 'processing_activities'}
          onToggle={() => handleToggleSection('processing_activities')}
          translate={translate}
          theme={theme}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#fff',
  },
  header: {
    marginBottom: 12,
  },
  headerContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginRight: 8,
  },
  mandatoryBadge: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#dc2626',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  mandatoryText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#dc2626',
  },
  description: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  actions: {
    alignItems: 'flex-end',
    marginTop: 8,
  },
  expiryBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  expiryText: {
    fontSize: 10,
    color: '#4b5563',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  switchLabelActive: {
    color: '#16a34a',
  },
  section: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  chevron: {
    fontSize: 12,
    color: '#6b7280',
  },
  sectionContent: {
    paddingBottom: 12,
  },
  subsection: {
    marginBottom: 12,
  },
  subsectionTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4b5563',
    marginBottom: 8,
    paddingLeft: 4,
  },
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  pill: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: {
    fontSize: 14,
    color: '#374151',
  },
});
