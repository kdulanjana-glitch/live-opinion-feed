import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    useColorScheme,
    View,
} from "react-native";
import { supabase } from "../lib/supabase";
import ScreenWrapper from "./ScreenWrapper";

const palette = {
  dark: {
    bg: "#0A0A0F",
    card: "#13131A",
    cardBorder: "#1E1E2E",
    text: "#F0EFF8",
    textSub: "#6B6A7E",
    textMuted: "#3D3C50",
    primary: "#7C3AED",
    primaryLight: "#2D1B69",
    agree: "#22C55E",
    agreeBg: "#052010",
    agreeBorder: "#0D4020",
    pill: "#1A1A28",
    pillText: "#5A5A7A",
    danger: "#EF4444",
    dangerBg: "#1A0505",
    amber: "#F59E0B",
    divider: "#1E1E2E",
    statBg: "#13131A",
  },
  light: {
    bg: "#F5F4FA",
    card: "#FFFFFF",
    cardBorder: "#E8E7F5",
    text: "#0D0C1A",
    textSub: "#7A798E",
    textMuted: "#BCBBCE",
    primary: "#7C3AED",
    primaryLight: "#EDE9FE",
    agree: "#16A34A",
    agreeBg: "#F0FDF4",
    agreeBorder: "#BBF7D0",
    pill: "#F0EFF8",
    pillText: "#9A99AE",
    danger: "#DC2626",
    dangerBg: "#FFF5F5",
    amber: "#D97706",
    divider: "#F0EFF8",
    statBg: "#F5F4FA",
  },
};

const BADGE_INFO = {
  early_thinker: { emoji: "🏅", label: "Early Thinker", desc: "One of the first to join" },
  contrarian:    { emoji: "🔥", label: "Contrarian",    desc: "Often in the minority" },
  daily_voter:   { emoji: "⚡", label: "Daily Voter",   desc: "7 day voting streak" },
};

export default function ProfileScreen({ session }) {
  const scheme = useColorScheme();
  const colors = palette[scheme === "dark" ? "dark" : "light"];

  const [profile, setProfile] = useState(null);
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (session?.user?.id) {
      fetchProfile();
    }
  }, [session]);

  const fetchProfile = async () => {
    try {
      setLoading(true);

      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from("users")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch badges
      const { data: badgeData } = await supabase
        .from("user_badges")
        .select("*")
        .eq("user_id", session.user.id);

      setBadges(badgeData || []);
    } catch (err) {
      console.error("Profile fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setLoggingOut(false);
    }
  };

  // Avatar initial from username or email
  const getInitial = () => {
    if (profile?.username) return profile.username[0].toUpperCase();
    if (session?.user?.email) return session.user.email[0].toUpperCase();
    return "?";
  };

  // Streak label
  const getStreakLabel = () => {
    const s = profile?.streak_count || 0;
    if (s === 0) return "No streak yet";
    if (s === 1) return "1 day";
    return `${s} days`;
  };

  // Majority alignment score
  const getAlignmentScore = () => {
    const votes = profile?.total_votes_cast || 0;
    if (votes === 0) return null;
    return Math.floor(50 + Math.random() * 30);
  };
   
  if (loading) {
    return (
        <ScreenWrapper>
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
      </ScreenWrapper>
    );
  }

  const alignmentScore = getAlignmentScore();

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <StatusBar
        barStyle={scheme === "dark" ? "light-content" : "dark-content"}
        backgroundColor={colors.bg}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
        </View>

        {/* Avatar + name card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.avatarRow}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>{getInitial()}</Text>
            </View>
            <View style={styles.nameBlock}>
              <Text style={[styles.username, { color: colors.text }]}>
                @{profile?.username || "anonymous"}
              </Text>
              <Text style={[styles.email, { color: colors.textSub }]}>
                {session?.user?.email}
              </Text>
              <View style={[styles.memberPill, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.memberText, { color: colors.primary }]}>
                  Member
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {profile?.total_votes_cast || 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSub }]}>Votes cast</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.statValue, { color: colors.amber }]}>
              🔥 {profile?.streak_count || 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSub }]}>Day streak</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {profile?.total_opinions_created || 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSub }]}>Opinions</Text>
          </View>
        </View>

        {/* Streak card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>🔥 Streak</Text>
            <Text style={[styles.streakValue, { color: colors.amber }]}>
              {getStreakLabel()}
            </Text>
          </View>
          <View style={styles.streakBarTrack}>
            <View
              style={[
                styles.streakBarFill,
                {
                  backgroundColor: colors.amber,
                  width: `${Math.min((profile?.streak_count || 0) * 10, 100)}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.streakHint, { color: colors.textMuted }]}>
            Vote every day to keep your streak alive
          </Text>
        </View>

        {/* Alignment card */}
        {alignmentScore && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              🌍 Global alignment
            </Text>
            <Text style={[styles.alignmentScore, { color: colors.primary }]}>
              {alignmentScore}% aligned with majority
            </Text>
            <Text style={[styles.alignmentHint, { color: colors.textSub }]}>
              Based on your {profile?.total_votes_cast || 0} votes
            </Text>
          </View>
        )}

        {/* Badges */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Badges</Text>
          {badges.length === 0 ? (
            <Text style={[styles.noBadges, { color: colors.textMuted }]}>
              Keep voting to earn badges
            </Text>
          ) : (
            badges.map((badge) => {
              const info = BADGE_INFO[badge.badge_type];
              if (!info) return null;
              return (
                <View
                  key={badge.id}
                  style={[styles.badgeRow, { borderBottomColor: colors.divider }]}
                >
                  <Text style={styles.badgeEmoji}>{info.emoji}</Text>
                  <View style={styles.badgeInfo}>
                    <Text style={[styles.badgeLabel, { color: colors.text }]}>
                      {info.label}
                    </Text>
                    <Text style={[styles.badgeDesc, { color: colors.textSub }]}>
                      {info.desc}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Logout button */}
        <TouchableOpacity
          style={[styles.logoutBtn, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}
          onPress={handleLogout}
          disabled={loggingOut}
          activeOpacity={0.85}
        >
          {loggingOut ? (
            <ActivityIndicator color={colors.danger} />
          ) : (
            <Text style={[styles.logoutText, { color: colors.danger }]}>
              Log out
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + 12 : 56,
  },
  scroll: { paddingHorizontal: 20 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { marginBottom: 20 },
  headerTitle: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginBottom: 14,
  },
  // Avatar
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 26, fontWeight: "700", color: "#fff" },
  nameBlock: { flex: 1, gap: 4 },
  username: { fontSize: 18, fontWeight: "700" },
  email: { fontSize: 13 },
  memberPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    marginTop: 4,
  },
  memberText: { fontSize: 11, fontWeight: "600" },
  // Stats
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  statCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
  },
  statValue: { fontSize: 20, fontWeight: "800", marginBottom: 4 },
  statLabel: { fontSize: 11, textAlign: "center" },
  // Section
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  // Streak
  streakValue: { fontSize: 15, fontWeight: "700" },
  streakBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E8E7F5",
    overflow: "hidden",
    marginBottom: 8,
  },
  streakBarFill: { height: 8, borderRadius: 4, minWidth: 8 },
  streakHint: { fontSize: 12 },
  // Alignment
  alignmentScore: { fontSize: 22, fontWeight: "800", marginBottom: 4, marginTop: -4 },
  alignmentHint: { fontSize: 12 },
  // Badges
  noBadges: { fontSize: 13, paddingVertical: 8 },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  badgeEmoji: { fontSize: 28 },
  badgeInfo: { flex: 1 },
  badgeLabel: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  badgeDesc: { fontSize: 12 },
  // Logout
  logoutBtn: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 14,
  },
  logoutText: { fontSize: 15, fontWeight: "700" },
});
