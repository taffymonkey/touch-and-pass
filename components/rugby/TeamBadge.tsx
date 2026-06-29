import React from 'react';
import { View, Text, Image, StyleSheet, ImageSourcePropType } from 'react-native';
import { BRAND_GREEN, TEXT_PRIMARY } from '@/constants/Colors';

interface TeamBadgeProps {
  logoUrl?: string | null;
  name: string;
  primaryColor?: string | null;
  size?: number;
}

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export default function TeamBadge({ logoUrl, name, primaryColor, size = 40 }: TeamBadgeProps) {
  const bgColor = primaryColor || BRAND_GREEN;
  const initials = getInitials(name);
  const fontSize = size * 0.35;

  if (logoUrl) {
    return (
      <View style={[styles.logoBg, { width: size, height: size, borderRadius: size / 2 }]}>
        <Image
          source={resolveImageSource(logoUrl)}
          style={{ width: size * 0.85, height: size * 0.85 }}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor },
      ]}
    >
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  logoBg: {
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: TEXT_PRIMARY,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
