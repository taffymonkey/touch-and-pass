import 'react-native-reanimated';
import React, { useEffect } from 'react';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SystemBars } from 'react-native-edge-to-edge';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Alert } from 'react-native';
import { useNetworkState } from 'expo-network';
import { DarkTheme, Theme, ThemeProvider } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { WidgetProvider } from '@/contexts/WidgetContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { NotificationProvider } from "@/contexts/NotificationContext";
import { DARK_BG, CARD_BG, BORDER_COLOR, TEXT_PRIMARY, BRAND_GREEN } from '@/constants/Colors';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

const RugbyDarkTheme: Theme = {
  ...DarkTheme,
  dark: true,
  colors: {
    primary: BRAND_GREEN,
    background: DARK_BG,
    card: CARD_BG,
    text: TEXT_PRIMARY,
    border: BORDER_COLOR,
    notification: '#ef4444',
  },
};

export default function RootLayout() {
  const networkState = useNetworkState();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  React.useEffect(() => {
    if (!networkState.isConnected && networkState.isInternetReachable === false) {
      Alert.alert(
        '🔌 You are offline',
        'You can keep using the app! Your changes will be saved locally and synced when you are back online.'
      );
    }
  }, [networkState.isConnected, networkState.isInternetReachable]);

  return (
    <>
      <StatusBar style="light" animated />
      <ThemeProvider value={RugbyDarkTheme}>
        <SafeAreaProvider>
          <AuthProvider>
            <NotificationProvider>
              <WidgetProvider>
                <GestureHandlerRootView>
                  <Stack>
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                    <Stack.Screen name="match/[id]" options={{ headerShown: false }} />
                    <Stack.Screen name="team/[id]" options={{ headerShown: false }} />
                    <Stack.Screen name="player/[id]" options={{ headerShown: false }} />
                    <Stack.Screen name="notification-preferences" options={{ title: 'Notification Preferences', headerShown: true }} />
                  </Stack>
                  <SystemBars style="light" />
                </GestureHandlerRootView>
              </WidgetProvider>
            </NotificationProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </>
  );
}
