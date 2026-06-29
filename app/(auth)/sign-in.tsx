import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import {
  DARK_BG, CARD_BG, BORDER_COLOR, TEXT_PRIMARY, TEXT_SECONDARY, BRAND_GREEN, LIVE_RED,
} from '@/constants/Colors';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    console.log('[SignIn] Sign in button pressed for:', email);
    if (!email || !password) {
      setError('Please enter your email and password');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: authError } = await signIn(email, password);
    setLoading(false);
    if (authError) {
      console.log('[SignIn] Error:', authError.message);
      setError(authError.message);
    } else {
      console.log('[SignIn] Success, navigating to tabs');
      router.replace('/(tabs)/(home)');
    }
  };

  const handleSignUpLink = () => {
    console.log('[SignIn] Navigate to sign up pressed');
    router.push('/(auth)/sign-up');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Logo / Title */}
          <View style={styles.logoSection}>
            <Image
              source={require('@/assets/images/7ed917ba-da4b-4f6c-8254-196108fe23ea.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.tagline}>Your rugby companion</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.formTitle}>Sign In</Text>

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={TEXT_SECONDARY}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Your password"
                placeholderTextColor={TEXT_SECONDARY}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSignIn}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkRow} onPress={handleSignUpLink}>
              <Text style={styles.linkText}>
                Don't have an account?{' '}
                <Text style={styles.linkHighlight}>Sign Up</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: DARK_BG },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoSection: { alignItems: 'center', marginBottom: 40 },
  logo: { width: 200, height: 80, marginBottom: 8 },
  tagline: { color: TEXT_SECONDARY, fontSize: 14, marginTop: 4 },
  form: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    padding: 24,
    gap: 16,
  },
  formTitle: { color: TEXT_PRIMARY, fontSize: 20, fontWeight: '700' },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: LIVE_RED,
    padding: 12,
  },
  errorText: { color: LIVE_RED, fontSize: 13 },
  inputGroup: { gap: 6 },
  inputLabel: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  input: {
    backgroundColor: DARK_BG,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: TEXT_PRIMARY,
    fontSize: 15,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  submitBtn: {
    backgroundColor: BRAND_GREEN,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkRow: { alignItems: 'center', paddingVertical: 4 },
  linkText: { color: TEXT_SECONDARY, fontSize: 14 },
  linkHighlight: { color: BRAND_GREEN, fontWeight: '700' },
});
