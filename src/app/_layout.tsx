import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

export default function Layout() {
  useEffect(() => {
    // Handle deep-link auth callbacks (password reset, magic link, etc.)
    // Supabase PKCE flow sends:  liveopinionfeed://auth?code=AUTHORIZATION_CODE
    const handleUrl = async ({ url }: { url: string }) => {
      if (!url) return;
      try {
        const { queryParams } = Linking.parse(url);
        const code = queryParams?.code as string | undefined;
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) console.warn('Deep link code exchange failed:', error.message);
          // onAuthStateChange in index.tsx fires automatically after this
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

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
