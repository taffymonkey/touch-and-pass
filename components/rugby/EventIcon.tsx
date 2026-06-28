import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LIVE_GREEN, YELLOW_CARD, RED_CARD, TEXT_PRIMARY } from '@/constants/Colors';

interface EventIconProps {
  type: string;
  size?: number;
}

function getEventConfig(type: string): { label: string; bg: string; text: string } {
  switch (type) {
    case 'try':
      return { label: 'T', bg: LIVE_GREEN, text: '#fff' };
    case 'conversion':
      return { label: 'C', bg: '#16a34a', text: '#fff' };
    case 'penalty':
      return { label: 'P', bg: '#d97706', text: '#fff' };
    case 'drop_goal':
      return { label: 'D', bg: '#b45309', text: '#fff' };
    case 'yellow_card':
      return { label: '■', bg: YELLOW_CARD, text: '#fff' };
    case 'red_card':
      return { label: '■', bg: RED_CARD, text: '#fff' };
    case 'substitution':
      return { label: '↕', bg: '#3b82f6', text: '#fff' };
    default:
      return { label: '?', bg: '#6b7280', text: '#fff' };
  }
}

export default function EventIcon({ type, size = 22 }: EventIconProps) {
  const config = getEventConfig(type);
  const fontSize = size * 0.55;

  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size / 4,
          backgroundColor: config.bg,
        },
      ]}
    >
      <Text style={[styles.label, { fontSize, color: config.text }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '800',
    lineHeight: undefined,
  },
});
