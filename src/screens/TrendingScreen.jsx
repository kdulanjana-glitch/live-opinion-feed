import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Platform,
    RefreshControl,
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
    agree: "#22C55E",
    disagree: "#EF4444",
    amber: "#F59E0B",
    pill: "#1A1A28",
    pillText: "#5A5A7A",
    bar: "#1E1E2E",
    rank1: "#F59E0B",
    rank2: "#9CA3AF",
    rank3: "#B45309",
    divider: "#1E1E2E",
  },
  light: {
    bg: "#F5F4FA",
    card: "#FFFFFF",
    cardBorder: "#E8E7F5",
    text: "#0D0C1A",
    textSub: "#7A798E",
    textMuted: "#BCBBCE",
    agree: "#16A34A",
    disagree: "#DC2626",
    amber: "#D97706",
    pill: "#F0EFF8",
    pillText: "#9A99AE",
    bar: "#F0EFF8",
    rank1: "#D97706",
    rank2: "#6B7280",
    rank3: "#92400E",
    divider: "#F0EFF8",
  },
};

const CATEGORY_LABELS = {
  love:    { label: "Love",    emoji: "❤️" },
  money:   { label: "Money",   emoji: "💰" },
  life:    { label: "Life",    emoji: "🌱" },
  tech:    { label: "Tech",    emoji: "💻" },
  society: { label: "Society", emoji: "🌍" },
};

const RANK_MEDALS = ["🥇", "🥈", "🥉"];

export default function TrendingScreen() {
  const scheme = useColorScheme();
  const colors = palette[scheme === "dark" ? "dark" : "light"];

  const [opinions, setOpinions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");

  useEffect(() => {
    fetchTrending();
  }, []);

  const fetchTrending = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("opinions")
        .select("*")
        .eq("status", "approved")
        .gt("total_votes", 0)
        .order("total_votes", { ascending: false })
        .limit(50);

      if (error) throw error;
      setOpinions(data || []);
    } catch (err) {
      console.error("Trending fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTrending();
    setRefreshing(false);
  };

  // Filter by category
  const filtered = selectedCategory === "all"
    ? opinions
    : opinions.filter((o) => o.category === selectedCategory);

  const getAgreePercent = (op) => {
    if (!op.total_votes) return 50;
    return Math.round((op.agree_count / op.total_votes) * 100);
  };

  const renderItem = ({ item, index }) => {
    const agreePercent = getAgreePercent(item);
    const disagreePercent = 100 - agreePercent;
    const catInfo = CATEGORY_LABELS[item.category];
    const isTop3 = index < 3;

    return (
      <View style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isTop3 ? colors.rank1 + "40" : colors.cardBorder,
          borderWidth: isTop3 ? 1.5 : 1,
        },
      ]}>
        {/* Rank + category row */}
        <View style={styles.cardTopRow}>
          <View style={styles.rankBadge}>
            {isTop3 ? (
              <Text style={styles.medalEmoji}>{RANK_MEDALS[index]}</Text>
            ) : (
              <Text style={[styles.rankNumber, { color: colors.textMuted }]}>
                #{index + 1}
              </Text>
            )}
          </View>
          {catInfo && (
            <View style={[styles.categoryPill, { backgroundColor: colors.pill }]}>
              <Text style={styles.categoryEmoji}>{catInfo.emoji}</Text>
              <Text style={[styles.categoryLabel, { color: colors.pillText }]}>
                {catInfo.label}
              </Text>
            </View>
          )}
          <View style={styles.votesChip}>
            <Text style={[styles.votesText, { color: colors.amber }]}>
              🔥 {item.total_votes?.toLocaleString()} votes
            </Text>
          </View>
        </View>

        {/* Opinion text */}
        <Text style={[styles.opinionText, { color: colors.text }]}>
          {item.text}
        </Text>

        {/* Vote bar */}
        <View style={styles.barSection}>
          <View style={[styles.barTrack, { backgroundColor: colors.bar }]}>
            <View
              style={[
                styles.barAgree,
                {
                  backgroundColor: colors.agree,
                  width: `${agreePercent}%`,
                },
              ]}
            />
            <View
              style={[
                styles.barDisagree,
                {
                  backgroundColor: colors.disagree,
                  width: `${disagreePercent}%`,
                },
              ]}
            />
          </View>
          <View style={styles.barLabels}>
            <Text style={[styles.barLabel, { color: colors.agree }]}>
              👍 {agreePercent}%
            </Text>
            <Text style={[styles.barLabel, { color: colors.disagree }]}>
              {disagreePercent}% 👎
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const categories = ["all", ...Object.keys(CATEGORY_LABELS)];

  return (
    <ScreenWrapper>
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <StatusBar
        barStyle={scheme === "dark" ? "light-content" : "dark-content"}
        backgroundColor={colors.bg}
      />

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Trending
        </Text>
        <Text style={[styles.headerSub, { color: colors.textSub }]}>
          Most voted opinions worldwide
        </Text>
      </View>

      {/* Category filter */}
      <View style={styles.filterWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item: cat }) => (
            <TouchableOpacity
              style={[
                styles.filterPill,
                {
                  backgroundColor:
                    selectedCategory === cat
                      ? colors.amber
                      : colors.pill,
                },
              ]}
              onPress={() => setSelectedCategory(cat)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.filterText,
                {
                  color: selectedCategory === cat ? "#fff" : colors.pillText,
                  fontWeight: selectedCategory === cat ? "700" : "400",
                },
              ]}>
                {cat === "all"
                  ? "🔥 All"
                  : `${CATEGORY_LABELS[cat].emoji} ${CATEGORY_LABELS[cat].label}`}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.amber} />
          <Text style={[styles.loadingText, { color: colors.textSub }]}>
            Loading trending opinions...
          </Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={[styles.emptyText, { color: colors.textSub }]}>
            No opinions in this category yet.{"\n"}Be the first to vote!
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.amber}
            />
          }
        />
      )}
    </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + 12 : 56,
  },
  header: { paddingHorizontal: 20, marginBottom: 16 },
  headerTitle: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  headerSub: { fontSize: 14, marginTop: 4 },
  filterWrapper: { marginBottom: 12 },
  filterRow: { paddingHorizontal: 20, gap: 8 },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterText: { fontSize: 13 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  loadingText: { marginTop: 12, fontSize: 14 },
  emptyText: { fontSize: 15, textAlign: "center", lineHeight: 24 },
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  card: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  rankBadge: { width: 28, alignItems: "center" },
  medalEmoji: { fontSize: 20 },
  rankNumber: { fontSize: 13, fontWeight: "700" },
  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  categoryEmoji: { fontSize: 11 },
  categoryLabel: { fontSize: 11, fontWeight: "600" },
  votesChip: { marginLeft: "auto" },
  votesText: { fontSize: 12, fontWeight: "600" },
  opinionText: {
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 24,
    letterSpacing: -0.3,
    marginBottom: 14,
  },
  barSection: { gap: 6 },
  barTrack: {
    height: 8,
    borderRadius: 4,
    flexDirection: "row",
    overflow: "hidden",
  },
  barAgree: { height: 8 },
  barDisagree: { height: 8 },
  barLabels: { flexDirection: "row", justifyContent: "space-between" },
  barLabel: { fontSize: 12, fontWeight: "600" },
});
