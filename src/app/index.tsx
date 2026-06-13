import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

// ── Peolia components ──────────────────────────
import TabBar from '../components/TabBar';

// ── Screens ────────────────────────────────────
import AuthScreen      from '../screens/AuthScreen';
import SentariumScreen from '../screens/SentariumScreen';
import TrendingScreen  from '../screens/TrendingScreen';
import FloatScreen     from '../screens/FloatScreen';
import PinScreen      from '../screens/PinScreen';         // Pin tab
import ProfileScreen   from '../screens/ProfileScreen';    // own + other citizen

// Tab keys used by TabBar: 'trending' | 'float' | 'sentarium' | 'pin' | 'profile'
// Hidden keys (not in TabBar): 'auth' | 'reset-password'

export default function Index() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const bg     = scheme === 'dark' ? '#0F0F14' : '#FFFFFF';

  const [session,       setSession]       = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [activeTab,     setActiveTab]     = useState('sentarium');
  const [userProfileId, setUserProfileId] = useState<string | null>(null);
  const [feedScrollToId, setFeedScrollToId] = useState<string | null>(null);

  // Refs so onAuthStateChange callback never captures stale state
  const activeTabRef = useRef('sentarium');
  const prevTabRef   = useRef('sentarium');

  const goToTab = (tab: string) => {
    activeTabRef.current = tab;
    setActiveTab(tab);
  };

  // ── Auth bootstrap ────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN') {
          setSession(session);
          if (activeTabRef.current === 'auth') {
            goToTab(prevTabRef.current || 'sentarium');
          }
        }
        if (event === 'SIGNED_OUT') {
          setSession(null);
          goToTab('sentarium');
          setUserProfileId(null);
        }
        if (event === 'PASSWORD_RECOVERY') {
          setSession(session);
          goToTab('reset-password');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  // ── Tab press handler ─────────────────────────
  const handleTabPress = (tabKey: string) => {
    // Require auth for float / pin / profile
    if (!session && ['float', 'pin', 'profile'].includes(tabKey)) {
      prevTabRef.current = activeTabRef.current;
      goToTab('auth');
      return;
    }
    setUserProfileId(null);
    goToTab(tabKey);
  };

  const handleRequireAuth = () => {
    prevTabRef.current = activeTabRef.current;
    goToTab('auth');
  };

  const handleNavigateToUser = (userId: string) => {
    setUserProfileId(userId);
  };

  const handleNavigateToFeedOpinion = (opinionId: string) => {
    setFeedScrollToId(opinionId);
    setUserProfileId(null);
    goToTab('sentarium');
  };

  // ── Screen renderer ───────────────────────────
  const renderScreen = () => {
    // User profile overlay — slides over any tab
    if (userProfileId) {
      return (
        <ProfileScreen
          userId={userProfileId}
          onBack={() => setUserProfileId(null)}
          onOpenSenti={handleNavigateToFeedOpinion}
        />
      );
    }

    switch (activeTab) {
      case 'auth':
        return <AuthScreen />;

      case 'reset-password':
        return <AuthScreen initialMode="reset-password" />;

      case 'sentarium':
        return (
          <SentariumScreen
            session={session}
            onRequireAuth={handleRequireAuth}
            onNavigateToUser={handleNavigateToUser}
            scrollToId={feedScrollToId}
            onScrolled={() => setFeedScrollToId(null)}
          />
        );

      case 'trending':
        return (
          <TrendingScreen
            onOpenSenti={handleNavigateToFeedOpinion}
          />
        );

      case 'float':
        return session ? (
          <FloatScreen
            onBack={() => goToTab('sentarium')}
            onFloated={() => goToTab('sentarium')}
          />
        ) : <AuthScreen />;

      case 'pin':
        return session ? (
          <PinScreen
            session={session}
            onOpenSenti={handleNavigateToFeedOpinion}   // UUID → Sentarium
          />
        ) : <AuthScreen />;

      case 'profile':
        return session ? (
          <ProfileScreen
            onOpenSenti={handleNavigateToFeedOpinion}
          />
        ) : <AuthScreen />;

      default:
        return null;
    }
  };

  // Hide tab highlight on auth / reset-password / user-profile overlay
  const hiddenTabs  = ['auth', 'reset-password'];
  const visibleTab  = userProfileId || hiddenTabs.includes(activeTab) ? '' : activeTab;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={styles.content}>
        {renderScreen()}
      </View>

      {/* Floating pill tab bar — hidden only on auth screens. Kept visible on the
          user-profile overlay so the bottom nav doesn't vanish and its bottom inset
          stops content running under the Android system nav buttons. */}
      {!hiddenTabs.includes(activeTab) && (
        <View style={{ backgroundColor: bg, paddingBottom: Math.max(insets.bottom, 0) }}>
          <TabBar activeTab={visibleTab} onTabPress={handleTabPress} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content:   { flex: 1 },
});
