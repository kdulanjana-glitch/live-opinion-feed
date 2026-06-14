import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  const [isGuest, setIsGuest] = useState(false);

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
          setIsGuest(false);
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
    // Guest — block Float, Pin, Profile
    if (isGuest && ['float', 'pin', 'profile'].includes(tabKey)) {
      Alert.alert(
        'Sign in required',
        'Create a free account to access this.',
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Sign in',
            onPress: () => {
              prevTabRef.current = activeTabRef.current;
              goToTab('auth');
            },
          },
        ]
      );
      return;
    }
    // Not logged in and not guest — require auth
    if (!session && !isGuest && ['float', 'pin', 'profile'].includes(tabKey)) {
      prevTabRef.current = activeTabRef.current;
      goToTab('auth');
      return;
    }
    setUserProfileId(null);
    goToTab(tabKey);
  };

  const handleRequireAuth = () => {
    if (isGuest) {
      Alert.alert(
        'Sign in required',
        'Create a free account to do that.',
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Sign in',
            onPress: () => {
              prevTabRef.current = activeTabRef.current;
              goToTab('auth');
            },
          },
        ]
      );
      return;
    }
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
  // Returns the non-feed view for the current tab, or null when the Sentarium
  // feed should show (the feed is rendered as a persistent layer so it doesn't
  // re-fetch every time you leave and return to the tab).
  const renderOverlay = () => {
    // User profile overlay — slides over any tab
    if (userProfileId) {
      return (
        <ProfileScreen
          userId={userProfileId}
          onBack={() => setUserProfileId(null)}
          onOpenSenti={handleNavigateToFeedOpinion}
          onOpenUser={handleNavigateToUser}
        />
      );
    }

    switch (activeTab) {
      case 'auth':
        return (
          <AuthScreen
            onAuth={(s) => {
              setSession(s);
              setIsGuest(false);
            }}
            onGuest={() => {
              setIsGuest(true);
              goToTab(prevTabRef.current || 'sentarium');
            }}
          />
        );

      case 'reset-password':
        return (
          <AuthScreen
            onAuth={(s) => {
              setSession(s);
              setIsGuest(false);
            }}
            onGuest={() => {
              setIsGuest(true);
              goToTab('sentarium');
            }}
          />
        );

      case 'sentarium':
        return null;   // persistent feed layer (rendered below) handles this tab

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
        ) : (
          <AuthScreen
            onAuth={(s) => {
              setSession(s);
              setIsGuest(false);
            }}
            onGuest={() => {
              setIsGuest(true);
              goToTab('sentarium');
            }}
          />
        );

      case 'pin':
        return session ? (
          <PinScreen
            session={session}
            onOpenSenti={handleNavigateToFeedOpinion}   // UUID → Sentarium
          />
        ) : (
          <AuthScreen
            onAuth={(s) => {
              setSession(s);
              setIsGuest(false);
            }}
            onGuest={() => {
              setIsGuest(true);
              goToTab('sentarium');
            }}
          />
        );

      case 'profile':
        return session ? (
          <ProfileScreen
            onOpenSenti={handleNavigateToFeedOpinion}
            onOpenUser={handleNavigateToUser}
          />
        ) : (
          <AuthScreen
            onAuth={(s) => {
              setSession(s);
              setIsGuest(false);
            }}
            onGuest={() => {
              setIsGuest(true);
              goToTab('sentarium');
            }}
          />
        );

      default:
        return null;
    }
  };

  // Hide tab highlight on auth / reset-password / user-profile overlay
  const hiddenTabs  = ['auth', 'reset-password'];
  const visibleTab  = userProfileId || hiddenTabs.includes(activeTab) ? '' : activeTab;

  const feedActive = !userProfileId && activeTab === 'sentarium';
  const overlay    = renderOverlay();

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={styles.content}>
        {/* Persistent Sentarium feed — always mounted, just hidden (not unmounted)
            when another view is active, so returning to the tab is instant. */}
        <View style={feedActive ? styles.fill : styles.hidden}>
          <SentariumScreen
            session={session}
            isGuest={isGuest}
            onRequireAuth={handleRequireAuth}
            onNavigateToUser={handleNavigateToUser}
            scrollToId={feedScrollToId}
            onScrolled={() => setFeedScrollToId(null)}
          />
        </View>

        {/* Everything else renders on top when active */}
        {overlay !== null && <View style={styles.fill}>{overlay}</View>}
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
  fill:      { flex: 1 },
  hidden:    { display: 'none' },
});
