import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";

const palette = {
  dark: {
    bg: "#0A0A0F", card: "#13131A", cardBorder: "#1E1E2E",
    text: "#F0EFF8", textSub: "#6B6A7E", textMuted: "#3D3C50",
    primary: "#7C3AED", primaryLight: "#2D1B69",
    agree: "#22C55E", disagree: "#EF4444",
    bar: "#1E1E2E",
  },
  light: {
    bg: "#F5F4FA", card: "#FFFFFF", cardBorder: "#E8E7F5",
    text: "#0D0C1A", textSub: "#7A798E", textMuted: "#BCBBCE",
    primary: "#7C3AED", primaryLight: "#EDE9FE",
    agree: "#16A34A", disagree: "#DC2626",
    bar: "#F0EFF8",
  },
};

export default function UserProfileScreen({ userId, session, onBack, onNavigateToFeed }) {
  const scheme = useColorScheme();
  const colors = palette[scheme === "dark" ? "dark" : "light"];

  const [user, setUser] = useState(null);
  const [opinions, setOpinions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) fetchUserData();
  }, [userId]);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const [userRes, opinionsRes] = await Promise.all([
        supabase.from("users").select("id, username").eq("id", userId).single(),
        supabase
          .from("opinions")
          .select("id, text, category, agree_count, disagree_count, total_votes, created_at")
          .eq("created_by", userId)
          .eq("status", "approved")
          .order("created_at", { ascending: false }),
      ]);
      setUser(userRes.data);
      setOpinions(opinionsRes.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const getAgreePercent = (op) => {
    if (!op.total_votes) return 50;
    return Math.round((op.agree_count / op.total_votes) * 100);
  };

  const renderOpinion = ({ item }) => {
    const agreePercent = getAgreePercent(item);
    const preview = item.text?.length > 100 ? item.text.slice(0, 100) + "…" : item.text;

    return (
      <TouchableOpacity
        style={[styles.opinionRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
        onPress={() => onNavigateToFeed?.(item.id)}
        activeOpacity={0.85}
      >
        <Text style={[styles.opinionText, { color: colors.text }]} numberOfLines={3}>{preview}</Text>
        {item.total_votes > 0 && (
          <View style={styles.barWrapper}>
            <View style={[styles.barTrack, { backgroundColor: colors.bar }]}>
              <View style={[styles.barAgree, { backgroundColor: colors.agree, width: `${agreePercent}%` }]} />
              <View style={[styles.barDisagree, { backgroundColor: colors.disagree, width: `${100 - agreePercent}%` }]} />
            </View>
            <View style={styles.barLabels}>
              <Text style={[styles.barLabel, { color: colors.agree }]}>👍 {agreePercent}%</Text>
              <Text style={[styles.barLabel, { color: colors.textMuted }]}>
                🔥 {item.total_votes.toLocaleString()} votes
              </Text>
              <Text style={[styles.barLabel, { color: colors.disagree }]}>{100 - agreePercent}% 👎</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const initial = user?.username?.[0]?.toUpperCase() ?? "?";

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <StatusBar
        barStyle={scheme === "dark" ? "light-content" : "dark-content"}
        backgroundColor={colors.bg}
      />

      {/* Header with back button */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Text style={[styles.backIcon, { color: colors.primary }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: colors.text }]}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={opinions}
          keyExtractor={(item) => item.id}
          renderItem={renderOpinion}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          ListHeaderComponent={() => (
            <View style={styles.profileHeader}>
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
              <Text style={[styles.username, { color: colors.text }]}>
                @{user?.username || "anonymous"}
              </Text>
              <View style={[styles.countPill, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.countText, { color: colors.primary }]}>
                  {opinions.length} {opinions.length === 1 ? "opinion" : "opinions"}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={() => (
            <View style={styles.centered}>
              <Text style={[styles.emptyText, { color: colors.textSub }]}>No opinions yet.</Text>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backIcon: { fontSize: 24, fontWeight: "700" },
  topBarTitle: { fontSize: 17, fontWeight: "700" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  profileHeader: { alignItems: "center", paddingVertical: 24, gap: 10 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 28, fontWeight: "700" },
  username: { fontSize: 20, fontWeight: "700" },
  countPill: {
    paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20,
  },
  countText: { fontSize: 13, fontWeight: "600" },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  opinionRow: {
    borderRadius: 16, borderWidth: 1, padding: 16, gap: 12,
  },
  opinionText: { fontSize: 16, fontWeight: "600", lineHeight: 22 },
  barWrapper: { gap: 6 },
  barTrack: {
    height: 6, borderRadius: 3, flexDirection: "row", overflow: "hidden",
  },
  barAgree: { height: 6 },
  barDisagree: { height: 6 },
  barLabels: { flexDirection: "row", justifyContent: "space-between" },
  barLabel: { fontSize: 11, fontWeight: "600" },
  emptyText: { fontSize: 15, textAlign: "center" },
});
