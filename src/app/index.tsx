import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import AuthScreen from '../screens/AuthScreen';
import CreateScreen from '../screens/CreateScreen';
import FeedScreen from '../screens/FeedScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SavedScreen from '../screens/SavedScreen';
import TrendingScreen from '../screens/TrendingScreen';
import UserProfileScreen from '../screens/UserProfileScreen';

export default function Index() {
  const scheme = useColorScheme();
  const colors = {
    bg: scheme === 'dark' ? '#0A0A0F' : '#F5F4FA',
    nav: scheme === 'dark' ? '#13131A' : '#FFFFFF',
    navBorder: scheme === 'dark' ? '#1E1E2E' : '#E8E7F5',
    active: '#7C3AED',
    inactive: scheme === 'dark' ? '#3D3C50' : '#BCBBCE',
  };

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('feed');
  const [userProfileId, setUserProfileId] = useState(null);
  const [feedScrollToId, setFeedScrollToId] = useState(null);

  const prevTabRef = useRef('feed');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN') {
          setSession(session);
          if (activeTab === 'auth') setActiveTab(prevTabRef.current || 'feed');
        }
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setActiveTab('feed');
          setUserProfileId(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  const TABS = [
    { key: 'feed',     label: 'Feed',    emoji: '🏠' },
    { key: 'trending', label: 'Trending', emoji: '🔥' },
    { key: 'create',   label: 'Create',  emoji: '➕' },
    { key: 'saved',    label: 'Saved',   emoji: '⭐' },
    { key: 'profile',  label: 'Profile', emoji: '👤' },
  ];

  const handleTabPress = (tabKey: string) => {
    if (!session && ['create', 'saved', 'profile'].includes(tabKey)) {
      prevTabRef.current = activeTab;
      setActiveTab('auth');
      return;
    }
    setUserProfileId(null);
    setActiveTab(tabKey);
  };

  const handleRequireAuth = () => {
    prevTabRef.current = activeTab;
    setActiveTab('auth');
  };

  const handleNavigateToUser = (userId: string) => {
    setUserProfileId(userId);
  };

  const handleBackFromUserProfile = () => {
    setUserProfileId(null);
  };

  const handleNavigateToFeedOpinion = (opinionId: string) => {
    setFeedScrollToId(opinionId);
    setActiveTab('feed');
    setUserProfileId(null);
  };

  const renderScreen = () => {
    if (userProfileId) {
      return (
        <UserProfileScreen
          userId={userProfileId}
          session={session}
          onBack={handleBackFromUserProfile}
          onNavigateToFeed={handleNavigateToFeedOpinion}
        />
      );
    }

    switch (activeTab) {
      case 'auth':
        return <AuthScreen />;
      case 'feed':
        return (
          <FeedScreen
            session={session}
            onRequireAuth={handleRequireAuth}
            onNavigateToUser={handleNavigateToUser}
            scrollToId={feedScrollToId}
            onScrolled={() => setFeedScrollToId(null)}
          />
        );
      case 'trending':
        return <TrendingScreen session={session} onRequireAuth={handleRequireAuth} />;
      case 'create':
        return session
          ? <CreateScreen session={session} />
          : <AuthScreen />;
      case 'saved':
        return session
          ? <SavedScreen session={session} onNavigateToFeed={handleNavigateToFeedOpinion} />
          : <AuthScreen />;
      case 'profile':
        return session
          ? <ProfileScreen session={session} />
          : <AuthScreen />;
      default:
        return null;
    }
  };

  const visibleTab = userProfileId ? '' : activeTab;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.content}>
        {renderScreen()}
      </View>

      <View style={[styles.bottomNav, { backgroundColor: colors.nav, borderTopColor: colors.navBorder }]}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={styles.navItem}
            onPress={() => handleTabPress(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.navIcon, { color: visibleTab === tab.key ? colors.active : colors.inactive }]}>
              {tab.emoji}
            </Text>
            <Text style={[styles.navLabel, {
              color: visibleTab === tab.key ? colors.active : colors.inactive,
              fontWeight: visibleTab === tab.key ? '700' : '400',
            }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1 },
  bottomNav: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingBottom: 20,
    paddingTop: 10,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  navIcon: { fontSize: 22 },
  navLabel: { fontSize: 11 },
});
