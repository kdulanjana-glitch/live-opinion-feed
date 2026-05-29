import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import CreateScreen from '../screens/CreateScreen';
import FeedScreen from '../screens/FeedScreen';
import ProfileScreen from '../screens/ProfileScreen';
import TrendingScreen from '../screens/TrendingScreen';

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN') setSession(session);
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setActiveTab('feed');
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

  if (!session) {
    const AuthScreen = require('../screens/AuthScreen').default;
    return <AuthScreen />;
  }

  const TABS = [
  { key: 'feed',     label: 'Feed',     emoji: '🏠' },
  { key: 'trending', label: 'Trending', emoji: '🔥' },
  { key: 'create',   label: 'Create',   emoji: '➕' },
  { key: 'profile',  label: 'Profile',  emoji: '👤' },
];

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>

      {/* Screen content */}
      <View style={styles.content}>
        {activeTab === 'feed'    && <FeedScreen    session={session} />}
        {activeTab === 'trending' && <TrendingScreen />}
        {activeTab === 'create'  && <CreateScreen  session={session} />}
        {activeTab === 'profile' && <ProfileScreen session={session} />}
      </View>

      {/* Bottom navigation */}
      <View style={[styles.bottomNav, { backgroundColor: colors.nav, borderTopColor: colors.navBorder }]}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={styles.navItem}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.navIcon, { color: activeTab === tab.key ? colors.active : colors.inactive }]}>
              {tab.emoji}
            </Text>
            <Text style={[styles.navLabel, { color: activeTab === tab.key ? colors.active : colors.inactive, fontWeight: activeTab === tab.key ? '700' : '400' }]}>
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
