import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import FloatingTabBar, { TabBarItem } from '@/components/FloatingTabBar';
import { DARK_BG } from '@/constants/Colors';

const TABS: TabBarItem[] = [
  { name: 'home', route: '/(tabs)/(home)', icon: 'sports-rugby', label: 'Scores' },
  { name: 'fixtures', route: '/(tabs)/fixtures', icon: 'favorite', label: 'Favourites' },
  { name: 'teams', route: '/(tabs)/teams', icon: 'groups', label: 'Teams' },
  { name: 'account', route: '/(tabs)/account', icon: 'person', label: 'Account' },
];

export default function TabLayout() {
  return (
    <View style={styles.container}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'none',
          contentStyle: { backgroundColor: DARK_BG },
        }}
      >
        <Stack.Screen name="(home)" />
        <Stack.Screen name="fixtures" />
        <Stack.Screen name="teams" />
        <Stack.Screen name="account" />
      </Stack>
      <FloatingTabBar tabs={TABS} containerWidth={340} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
  },
});
