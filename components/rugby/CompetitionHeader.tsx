import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TEXT_SECONDARY, BORDER_COLOR } from '@/constants/Colors';

interface CompetitionHeaderProps {
  name: string;
}

export default function CompetitionHeader({ name }: CompetitionHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <Text style={styles.name}>{name}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: BORDER_COLOR,
  },
  name: {
    color: TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
