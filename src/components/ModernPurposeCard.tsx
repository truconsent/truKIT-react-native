/**
 * ModernPurposeCard - React Native purpose card component
 */
import React, { useState } from 'react';
import { View, Text, Switch, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Purpose, Banner } from '../core/types';
import CollapsibleDataSection from './CollapsibleDataSection';

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
}

export default function ModernPurposeCard({
  purpose,
  banner,
  onToggle,
}: ModernPurposeCardProps) {
  const { t, i18n } = useTranslation();
  const [openSection, setOpenSection] = useState<string | null>(null);
  const isMandatory = purpose.is_mandatory;
  const isAccepted = purpose.consented === 'accepted' || (purpose.consented as any) === true;
  const expiryLabel = purpose.expiry_label || purpose.expiry_period || '1 Year';

  const handleToggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  const dataElements = purpose.data_elements || [];
  const processingActivities = purpose.processing_activities || [];
  const legalEntities = purpose.legal_entities || [];
  const tools = purpose.tools || [];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{translateDynamic(purpose.name, i18n.language)}</Text>
            {isMandatory && (
              <View style={styles.mandatoryBadge}>
                <Text style={styles.mandatoryText}>{t('mandatory')}</Text>
              </View>
            )}
          </View>
          <Text style={styles.description}>{translateDynamic(purpose.description, i18n.language)}</Text>
        </View>
        <View style={styles.actions}>
          <View style={styles.expiryBadge}>
            <Text style={styles.expiryText}>{t('expiry_type', { expiry: expiryLabel })}</Text>
          </View>
          <View style={styles.switchContainer}>
            <Text style={[styles.switchLabel, isAccepted && styles.switchLabelActive]}>
              {t('accept')}
            </Text>
            <View style={{ width: 8 }} />
            <Switch
              value={isAccepted}
              onValueChange={(value) => onToggle && onToggle(purpose.id, value ? 'accepted' : 'declined')}
              disabled={!onToggle}
              trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
              thumbColor={isAccepted ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>
      </View>

      {dataElements.length > 0 && (
        <CollapsibleDataSection
          title={t('data_elements')}
          items={dataElements}
          isOpen={openSection === 'data_elements'}
          onToggle={() => handleToggleSection('data_elements')}
        />
      )}

      {banner?.show_processors !== false && (legalEntities.length > 0 || tools.length > 0) && (
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => handleToggleSection('data_processors')}
          >
            <Text style={styles.sectionTitle}>{t('data_processors') || 'Data Processors'}</Text>
            <Text style={styles.chevron}>{openSection === 'data_processors' ? '▼' : '▶'}</Text>
          </TouchableOpacity>
          {openSection === 'data_processors' && (
            <View style={styles.sectionContent}>
              {legalEntities.length > 0 && (
                <View style={styles.subsection}>
                  <Text style={styles.subsectionTitle}>
                    {t('legal_entities')} ({legalEntities.length})
                  </Text>
                  <View style={styles.pillsContainer}>
                    {legalEntities.map((item) => (
                      <View key={item.id} style={styles.pill}>
                        <Text style={styles.pillText}>
                          {translateDynamic(item.name, i18n.language)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
              {tools.length > 0 && (
                <View style={styles.subsection}>
                  <Text style={styles.subsectionTitle}>
                    {t('tools')} ({tools.length})
                  </Text>
                  <View style={styles.pillsContainer}>
                    {tools.map((item, index) => (
                      <View key={item.id} style={[styles.pill, index > 0 && { marginLeft: 8, marginTop: 8 }]}>
                        <Text style={styles.pillText}>
                          {translateDynamic(item.name, i18n.language)}
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
          title={t('processing_activities') || 'Processing Activities'}
          items={processingActivities}
          isOpen={openSection === 'processing_activities'}
          onToggle={() => handleToggleSection('processing_activities')}
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

