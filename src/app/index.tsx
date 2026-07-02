import {
  useEffect,
  useRef,
  useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  StyleSheet,
  View,
} from 'react-native';
import { usePeoliaScheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

// ── Peolia components ──────────────────────────
import TabBar from '../components/TabBar';
import NotificationToast from '../components/NotificationToast';

// ── Screens ────────────────────────────────────
import AuthScreen      from '../screens/AuthScreen';
import SentariumScreen from '../screens/SentariumScreen';
import TrendingScreen  from '../screens/TrendingScreen';
import FloatScreen     from '../screens/FloatScreen';
import PinScreen      from '../screens/PinScreen';         // Pin tab
import ProfileScreen   from '../screens/ProfileScreen';    // own + other citizen
import SuspendedScreen from '../screens/SuspendedScreen';  // banned-account block
import DMConversationScreen from '../screens/DMConversationScreen';  // direct messages overlay
import ShareToDMSheet from '../components/ShareToDMSheet';            // share a senti into a DM

import SplashScreen         from '../screens/onboarding/SplashScreen';
import WalkthroughScreen    from '../screens/onboarding/WalkthroughScreen';
import UsernameDisplayNameScreen from '../screens/onboarding/UsernameDisplayNameScreen';
import PhoneDOBGenderScreen from '../screens/onboarding/PhoneDOBGenderScreen';
import YoureInScreen        from '../screens/onboarding/YoureInScreen';

// Tab keys used by TabBar: 'trending' | 'float' | 'sentarium' | 'pin' | 'profile'
// Hidden keys (not in TabBar): 'auth' | 'reset-password'

export default function Index() {
  const insets = useSafeAreaInsets();
  const scheme = usePeoliaScheme();
  const bg     = scheme === 'dark' ? '#0F0F14' : '#FFFFFF';
  const {
    registerNavigationHandler,
    currentToast,
    dismissCurrentToast,
    navigateToNotification,
  } = useNotifications();

  const [session,       setSession]       = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [activeTab,     setActiveTab]     = useState('sentarium');
  const [userProfileId, setUserProfileId] = useState<string | null>(null);
  const [dmOverlayUserId, setDmOverlayUserId] = useState<string | null>(null);
  const [shareSentiId, setShareSentiId] = useState<string | null>(null);
  const [feedScrollToId, setFeedScrollToId] = useState<string | null>(null);
  const [focusSenti, setFocusSenti] = useState<
    { id: string; openVoice: boolean; token: number } | null
  >(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<
    'splash' | 'walkthrough' | 'auth' |
    'username' | 'phone-dob-gender' | 'youre-in' | 'complete'
  >('splash');
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  // Refs so onAuthStateChange callback never captures stale state
  const activeTabRef = useRef('sentarium');
  const prevTabRef   = useRef('sentarium');

  const goToTab = (tab: string) => {
    activeTabRef.current = tab;
    setActiveTab(tab);
  };

  // Open a DM thread on top of everything (incl. the profile overlay).
  const openDM = (userId: string) => setDmOverlayUserId(userId);

  // ── Android hardware back — unwind overlays instead of exiting the app ──
  // Modals (share sheet, action sheets, menus) already close themselves via
  // onRequestClose; this handles the plain-View overlays + tab position.
  // Order: DM overlay → profile overlay → non-home tab → default (exit).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (dmOverlayUserId) { setDmOverlayUserId(null); return true; }
      if (userProfileId)   { setUserProfileId(null);   return true; }
      if (activeTab !== 'sentarium' && !['auth', 'reset-password'].includes(activeTab)) {
        goToTab('sentarium');
        return true;
      }
      return false;   // home tab, nothing open → let Android exit
    });
    return () => sub.remove();
  }, [dmOverlayUserId, userProfileId, activeTab]);

  const checkOnboarding = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('users')
        .select('onboarding_completed')
        .eq('id', userId)
        .single();
      if (data?.onboarding_completed) {
        setOnboardingStep('complete');
      } else {
        setOnboardingStep('username');
      }
    } catch {
      setOnboardingStep('username');
    } finally {
      setOnboardingChecked(true);
    }
  };

  // ── Banned-account check (returns true when suspended) ──
  const checkBanned = async (userId: string) => {
    try {
      const { data: userRecord } = await supabase
        .from('users')
        .select('is_banned')
        .eq('id', userId)
        .single();
      if (userRecord?.is_banned) {
        setIsBanned(true);
        return true;
      }
    } catch {
      // network/RLS hiccup — don't lock an innocent citizen out
    }
    return false;
  };

  // ── Auth bootstrap ────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user?.id) {
        const banned = await checkBanned(session.user.id);
        if (!banned) checkOnboarding(session.user.id);
      } else {
        setOnboardingStep('splash');
        setOnboardingChecked(true);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN') {
          setSession(session);
          setIsGuest(false);
          if (session?.user?.id) {
            // Covers OAuth + deep-link sign-ins too (AuthScreen's own gate only
            // sees the password path).
            const banned = await checkBanned(session.user.id);
            if (banned) return;
            checkOnboarding(session.user.id);
          }
          if (activeTabRef.current === 'auth') {
            goToTab(prevTabRef.current || 'sentarium');
          }
        }
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setIsGuest(false);
          setIsBanned(false);
          setOnboardingStep('auth');
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

  // ── Ban-watch: catch a mid-session ban live ───────────────────────────────
  // If an admin bans this citizen while the app is open, flip to the
  // SuspendedScreen immediately. Channel is removed on sign-out/unmount.
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    const banChannel = supabase
      .channel(`ban-watch-${uid}-${Date.now()}`)   // unique topic per mount (avoids reuse-after-subscribe)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${uid}` },
        (payload) => {
          if (payload.new?.is_banned === true) setIsBanned(true);
        })
      .subscribe();
    return () => { supabase.removeChannel(banChannel); };
  }, [session?.user?.id]);

  // ── Notification navigation ───────────────────
  // Registered once; the context calls this when a toast or list row is tapped.
  // 'follow' → that citizen's profile overlay; everything else → the senti in
  // the feed (voice/reply also open the VoiceSheet via focusSenti.openVoice).
  useEffect(() => {
    registerNavigationHandler((n) => {
      if (n.type === 'follow') {
        setUserProfileId(n.actor_id);
      } else if (n.senti_id) {
        setUserProfileId(null);
        setFocusSenti({ id: n.senti_id, openVoice: n.type !== 'react', token: Date.now() });
        goToTab('sentarium');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  // ── Suspended account — full-screen block, BEFORE the onboarding gate.
  // No tab bar, no overlays; the only exit is Sign out.
  if (isBanned) {
    return (
      <View style={[styles.container, { backgroundColor: bg }]}>
        <SuspendedScreen onSignOut={() => setIsBanned(false)} />
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
          onOpenDM={openDM}
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
            onOpenDM={openDM}
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

  // Show onboarding screens when not yet complete
  const isOnboarding = !isGuest && (
    !session ||
    (session && onboardingChecked && onboardingStep !== 'complete')
  );

  if (isOnboarding) {
    switch (onboardingStep) {
      case 'splash':
        return (
          <View style={[styles.container, { backgroundColor: bg }]}>
            <SplashScreen onDone={() => setOnboardingStep('walkthrough')} />
          </View>
        );
      case 'walkthrough':
        return (
          <View style={[styles.container, { backgroundColor: bg }]}>
            <WalkthroughScreen onDone={() => setOnboardingStep('auth')} />
          </View>
        );
      case 'auth':
        return (
          <View style={[styles.container, { backgroundColor: bg }]}>
            <AuthScreen
              onAuth={(s) => {
                setSession(s);
                setIsGuest(false);
                if (s?.user?.id) checkOnboarding(s.user.id);
              }}
              onGuest={() => {
                setIsGuest(true);
                setOnboardingStep('complete');
              }}
            />
          </View>
        );
      case 'username':
        return (
          <View style={[styles.container, { backgroundColor: bg }]}>
            <UsernameDisplayNameScreen
              userId={session?.user?.id ?? ''}
              onDone={() => setOnboardingStep('phone-dob-gender')}
            />
          </View>
        );
      case 'phone-dob-gender':
        return (
          <View style={[styles.container, { backgroundColor: bg }]}>
            <PhoneDOBGenderScreen
              userId={session?.user?.id ?? ''}
              onDone={() => setOnboardingStep('youre-in')}
            />
          </View>
        );
      case 'youre-in':
        return (
          <View style={[styles.container, { backgroundColor: bg }]}>
            <YoureInScreen
              userId={session?.user?.id ?? ''}
              onDone={() => setOnboardingStep('complete')}
            />
          </View>
        );
      default:
        return null;
    }
  }

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
            focusSenti={focusSenti}
            onShareSentiToDM={(sentiId: string) => setShareSentiId(sentiId)}
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

      {/* DM conversation overlay — on top of everything incl. the profile overlay
          and tab bar. Profile stays mounted underneath (scroll preserved). */}
      {dmOverlayUserId && (
        <View style={StyleSheet.absoluteFill}>
          <DMConversationScreen
            otherUserId={dmOverlayUserId}
            onBack={() => setDmOverlayUserId(null)}
            onOpenSenti={(sentiId: string) => {
              setDmOverlayUserId(null);
              handleNavigateToFeedOpinion(sentiId);
            }}
            onOpenProfile={(userId: string) => {
              setDmOverlayUserId(null);
              handleNavigateToUser(userId);
            }}
          />
        </View>
      )}

      {/* Share-a-senti-to-DM recipient picker */}
      <ShareToDMSheet
        visible={!!shareSentiId}
        sentiId={shareSentiId}
        onClose={() => setShareSentiId(null)}
        onShared={(userId: string) => {
          setShareSentiId(null);
          setDmOverlayUserId(userId);
        }}
      />

      {/* In-app notification toast — absolute, above everything */}
      <NotificationToast
        notification={currentToast}
        onDismiss={dismissCurrentToast}
        onPress={() => navigateToNotification(currentToast)}
      />
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
