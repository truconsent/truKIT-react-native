/**
 * ModernBannerFooter - React Native banner footer component
 */
import React from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import { BannerTheme } from '../utils/ColorUtils';

export interface ModernBannerFooterProps {
  footerText: string;
  orgName: string;
  theme?: BannerTheme;
  translate?: (text: string) => string;
}

function convertMarkdownLinks(
  text: string,
  linkColor: string,
  fontFamily?: string
): React.ReactNode[] {
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = markdownLinkRegex.exec(text)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    // Add the link
    const linkText = match[1];
    let url = match[2].trim();
    if (!url.match(/^[a-zA-Z]+:\/\//)) {
      url = `https://${url}`;
    }

    parts.push(
      <Text
        key={match.index}
        style={[styles.link, { color: linkColor, fontFamily }]}
        onPress={() => Linking.openURL(url)}
      >
        {linkText}
      </Text>
    );

    lastIndex = markdownLinkRegex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

export default function ModernBannerFooter({
  footerText,
  orgName,
  theme,
  translate = (text: string) => text || '',
}: ModernBannerFooterProps) {
  const processedText = translate(footerText || '').replace(/\[Organization Name\]/g, orgName);
  // Matches truKIT-NPM's ModernBannerFooter.jsx: link color follows the
  // banner's primary/button color, not a fixed hardcoded hue.
  const linkColor = theme?.button ?? '#9333ea';
  const content = convertMarkdownLinks(processedText, linkColor, theme?.fontFamily);

  return (
    <View style={styles.container}>
      <Text style={[styles.text, { color: theme?.textMuted ?? '#6b7280', fontFamily: theme?.fontFamily }]}>
        {content}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  text: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  link: {
    color: '#9333ea',
    textDecorationLine: 'underline',
  },
});
