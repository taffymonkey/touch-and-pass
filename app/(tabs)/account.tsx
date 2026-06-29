import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useAuth } from '@/contexts/AuthContext';
import {
  DARK_BG, CARD_BG, BORDER_COLOR, TEXT_PRIMARY, TEXT_SECONDARY, BRAND_GREEN, LIVE_RED,
} from '@/constants/Colors';

export default function AccountScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [demoMode, setDemoMode] = useState(false);

  const handleSignOut = () => {
    console.log('[Account] Sign out button pressed');
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            console.log('[Account] Confirmed sign out');
            await signOut();
          },
        },
      ]
    );
  };

  const handleSignIn = () => {
    console.log('[Account] Sign in button pressed');
    router.push('/(auth)/sign-in');
  };

  const handleDemoToggle = (value: boolean) => {
    console.log('[Account] Demo mode toggle pressed, new value:', value);
    Alert.alert(
      value ? 'Enable Demo Mode' : 'Disable Demo Mode',
      value
        ? 'Switch to the demo database for testing?'
        : 'Switch back to the live database?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            console.log('[Account] Demo mode confirmed:', value);
            setDemoMode(value);
          },
        },
      ]
    );
  };

  const avatarLetter = user?.email ? user.email[0].toUpperCase() : '?';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Account</Text>
        </View>

        {user ? (
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>{avatarLetter}</Text>
            </View>
            <Text style={styles.email}>{user.email}</Text>
            <View style={styles.fanBadge}>
              <Text style={styles.fanBadgeText}>Fan Account</Text>
            </View>
            <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.signInCard}>
            <Text style={styles.signInPrompt}>Sign in to save favourites and more</Text>
            <TouchableOpacity style={styles.signInBtn} onPress={handleSignIn}>
              <Text style={styles.signInBtnText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Demo Mode */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Developer</Text>
          <View style={styles.demoCard}>
            <View style={styles.demoRow}>
              <View style={styles.demoInfo}>
                <Text style={styles.demoLabel}>Demo Database</Text>
                <Text style={styles.demoDesc}>Switch to demo database for testing</Text>
              </View>
              <Switch
                value={demoMode}
                onValueChange={handleDemoToggle}
                trackColor={{ false: BORDER_COLOR, true: BRAND_GREEN }}
                thumbColor={demoMode ? '#fff' : TEXT_SECONDARY}
              />
            </View>
            {demoMode && (
              <View style={styles.demoBadge}>
                <Text style={styles.demoBadgeText}>Connected to demo database</Text>
              </View>
            )}
          </View>
        </View>

        {/* App info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>App</Text>
              <Text style={styles.infoValue}>Fifty22</Text>
            </View>
            <View style={[styles.infoRow, styles.infoRowLast]}>
              <Text style={styles.infoLabel}>Version</Text>
              <Text style={styles.infoValue}>1.0.0</Text>
            </View>
          </View>
        </View>

        <View style={styles.versionRow}>
          <Text style={styles.versionText}>
            Fifty22 v{Constants.expoConfig?.version ?? '1.0.0'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: DARK_BG },
  scrollContent: { paddingBottom: 120 },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: TEXT_PRIMARY, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  profileCard: {
    margin: 16,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: BRAND_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: '#fff', fontSize: 28, fontWeight: '800' },
  email: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600' },
  fanBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(26,71,42,0.5)',
    borderWidth: 1,
    borderColor: BRAND_GREEN,
  },
  fanBadgeText: { color: BRAND_GREEN, fontSize: 12, fontWeight: '700' },
  signOutBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: LIVE_RED,
  },
  signOutText: { color: LIVE_RED, fontSize: 14, fontWeight: '700' },
  signInCard: {
    margin: 16,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    padding: 24,
    alignItems: 'center',
    gap: 16,
  },
  signInPrompt: { color: TEXT_SECONDARY, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  signInBtn: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: BRAND_GREEN,
  },
  signInBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  section: { paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  demoCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    overflow: 'hidden',
  },
  demoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  demoInfo: { flex: 1 },
  demoLabel: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '600' },
  demoDesc: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },
  demoBadge: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  demoBadgeText: { color: '#f59e0b', fontSize: 12, fontWeight: '600' },
  infoCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel: { color: TEXT_SECONDARY, fontSize: 14 },
  infoValue: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '600' },
  versionRow: { alignItems: 'center', paddingVertical: 24 },
  versionText: { color: TEXT_SECONDARY, fontSize: 12 },
});
