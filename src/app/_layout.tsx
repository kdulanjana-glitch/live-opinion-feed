import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import ErrorBoundary from '../components/ErrorBoundary';
import AppLockGate from '../components/AppLockGate';
import { ThemeProvider } from '../context/ThemeContext';
import { NotificationProvider } from '../context/NotificationContext';
import { BlockProvider } from '../context/BlockContext';
import { WavePrefsProvider } from '../context/WavePrefsContext';
import { supabase } from '../lib/supabase';

// Silence a deprecation warning fired from inside react-native-country-picker-modal
// (v2.0.0 imports the old SafeAreaView). Not our code; harmless. Dev-only noise.
LogBox.ignoreLogs(['SafeAreaView has been deprecated']);

const processedCodes = new Set<string>();

export default function Layout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    // Handle deep-link auth callbacks (password reset, magic link, etc.)
    // Supabase PKCE flow sends:  liveopinionfeed://auth?code=AUTHORIZATION_CODE
    const handleUrl = async ({ url }: { url: string }) => {
      if (!url) return;
      try {
        const { queryParams } = Linking.parse(url);
        const code = queryParams?.code as string | undefined;
        if (code) {
          if (processedCodes.has(code)) return; // already handled — skip
          processedCodes.add(code);
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) console.warn('Deep link code exchange failed:', error.message);
        }
      } catch (e) {
        console.warn('Deep link parse error:', e);
      }
    };

    // App was already open when link was tapped
    const sub = Linking.addEventListener('url', handleUrl);
    // App was closed and opened via link
    Linking.getInitialURL().then((url) => { if (url) handleUrl({ url }); });

    return () => sub.remove();
  }, []);

  // Hold render until Plus Jakarta Sans is ready so text doesn't flash the
  // system font then reflow.
  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <NotificationProvider>
          <BlockProvider>
            <WavePrefsProvider>
              <ErrorBoundary>
                <AppLockGate>
                  <Stack screenOptions={{ headerShown: false }} />
                </AppLockGate>
              </ErrorBoundary>
            </WavePrefsProvider>
          </BlockProvider>
        </NotificationProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
