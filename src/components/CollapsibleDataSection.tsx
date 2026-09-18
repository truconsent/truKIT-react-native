/**
 * CollapsibleDataSection - React Native collapsible section component
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { DataElement, ProcessingActivity } from '../core/types';
import { BannerTheme } from '../utils/ColorUtils';

const dynamicTranslations: Record<string, Record<string, string>> = {
  ta: {
    Gender: 'பாலினம்',
    'Email Address': 'மின்னஞ்சல் முகவரி',
    'Date of Birth': 'பிறந்த தேதி',
    'PAN Number': 'பான் எண்',
    'Mobile Number': 'மொபைல் எண்',
    Name: 'பெயர்',
    'Aadhar Number': 'ஆதார் எண்',
    Address: 'முகவரி',
  },
  hi: {
    Gender: 'लिंग',
    'Email Address': 'ईमेल पता',
    'Date of Birth': 'जन्म की तारीख',
    'PAN Number': 'पैन नंबर',
    'Mobile Number': 'मोबाइल नंबर',
    Name: 'नाम',
    'Aadhar Number': 'आधार संख्या',
    Address: 'पता',
  },
};

const translateDynamic = (text: string, language: string): string => {
  if (dynamicTranslations[language] && dynamicTranslations[language][text]) {
    return dynamicTranslations[language][text];
  }
  return text;
};

export interface CollapsibleDataSectionProps {
  title: string;
  items: (DataElement | ProcessingActivity)[];
  isOpen: boolean;
  onToggle: () => void;
  /** Translates dynamic (server-supplied) text via the banner's translation
   * snapshot. Falls back to the small hardcoded dict above, then to the
   * original text, if the snapshot has no match. */
  translate?: (text: string) => string;
  /** "Common Appearance" theme (secondary/text colors, font) from the admin
   * dashboard. */
  theme?: BannerTheme;
}

export default function CollapsibleDataSection({
  title,
  items,
  isOpen,
  onToggle,
  translate,
  theme,
}: CollapsibleDataSectionProps) {
  const { i18n } = useTranslation();

  const localize = (text: string): string => {
    const snapshotResult = translate ? translate(text) : text;
    if (snapshotResult !== text) return snapshotResult;
    return translateDynamic(text, i18n.language);
  };

  const mutedColor = theme?.textMuted ?? '#374151';
  const textColor = theme?.text ?? '#374151';
  const borderColor = theme?.border ?? '#e5e7eb';
  const fontFamily = theme?.fontFamily;

  return (
    <View style={[styles.section, { borderTopColor: borderColor }]}>
      <TouchableOpacity style={styles.header} onPress={onToggle}>
        <Text style={[styles.title, { color: mutedColor, fontFamily }]}>
          {title} ({items.length})
        </Text>
        <Text style={[styles.chevron, { color: mutedColor }]}>{isOpen ? '▼' : '▶'}</Text>
      </TouchableOpacity>
      {isOpen && (
        <View style={styles.content}>
          {items.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.pill,
                { backgroundColor: theme?.background ?? '#fff', borderColor },
                index > 0 && { marginLeft: 8, marginTop: 8 },
              ]}
            >
              <Text style={[styles.pillText, { color: textColor, fontFamily }]}>
                {localize(item.name)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  chevron: {
    fontSize: 12,
    color: '#6b7280',
  },
  content: {
    paddingTop: 8,
    paddingBottom: 16,
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

