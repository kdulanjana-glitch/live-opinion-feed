import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const palette = {
  dark: {
    bg: "#0A0A0F",
    card: "#0D0D14",
    cardBorder: "#1E1E2E",
    text: "#F0EFF8",
    textSub: "#6B6A7E",
    textMuted: "#3D3C50",
    agree: "#22C55E",
    agreeBg: "#052010",
    agreeBorder: "#0D4020",
    disagree: "#EF4444",
    disagreeBg: "#1A0505",
    disagreeBorder: "#3D1010",
    pill: "#1A1A28",
    pillText: "#5A5A7A",
    minority: "#F59E0B",
    bar: "#1E1E2E",
    next: "#7C3AED",
    nextBtn: "#1A1A28",
    nextBtnBorder: "#2A2A3A",
  },
  light: {
    bg: "#F5F4FA",
    card: "#FFFFFF",
    cardBorder: "#E8E7F5",
    text: "#0D0C1A",
    textSub: "#7A798E",
    textMuted: "#BCBBCE",
    agree: "#16A34A",
    agreeBg: "#F0FDF4",
    agreeBorder: "#BBF7D0",
    disagree: "#DC2626",
    disagreeBg: "#FFF5F5",
    disagreeBorder: "#FECACA",
    pill: "#F0EFF8",
    pillText: "#9A99AE",
    minority: "#D97706",
    bar: "#F0EFF8",
    next: "#7C3AED",
    nextBtn: "#F0EFF8",
    nextBtnBorder: "#E8E7F5",
  },
};

const CATEGORY_LABELS = {
  love: "Love", money: "Money", life: "Life", tech: "Tech", society: "Society",
};

export default function FeedScreen({ session }) {
  const scheme = useColorScheme();
  const colors = palette[scheme === "dark" ? "dark" : "light"];

  const [opinions, setOpinions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [votedOpinion, setVotedOpinion] = useState(null);
  const [userVote, setUserVote] = useState(null);
  const [loading, setLoading] = useState(true);

  const cardOpacity = useRef(new Animated.Value(1)).current;
  const cardTranslateY = useRef(new Animated.Value(0)).current;
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const barWidth = useRef(new Animated.Value(0)).current;
  const nextBtnScale = useRef(new Animated.Value(1)).current;

  useEffect(() => { fetchOpinions(); }, []);

  useEffect(() => {
    const channel = supabase
      .channel("opinions-realtime")
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "opinions" },
        (payload) => {
          setOpinions((prev) =>
            prev.map((op) => op.id === payload.new.id ? { ...op, ...payload.new } : op)
          );
          setVotedOpinion((prev) =>
            prev?.id === payload.new.id ? { ...prev, ...payload.new } : prev
          );
        }
      ).subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const fetchOpinions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("opinions")
        .select("*")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      setOpinions([...data].sort(() => Math.random() - 0.5));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const goNext = () => {
    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(cardTranslateY, { toValue: -60, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      setUserVote(null);
      setVotedOpinion(null);
      barWidth.setValue(0);
      resultOpacity.setValue(0);
      cardTranslateY.setValue(60);
      cardOpacity.setValue(0);

      setCurrentIndex((prev) => {
        const next = prev + 1;
        if (next >= opinions.length) {
          fetchOpinions();
          return 0;
        }
        return next;
      });

      Animated.parallel([
        Animated.spring(cardTranslateY, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleVote = async (value) => {
    if (userVote) return;
    const opinion = opinions[currentIndex];
    if (!opinion) return;

    const updated = {
      ...opinion,
      agree_count: value === "agree" ? opinion.agree_count + 1 : opinion.agree_count,
      disagree_count: value === "disagree" ? opinion.disagree_count + 1 : opinion.disagree_count,
      total_votes: opinion.total_votes + 1,
    };
    setVotedOpinion(updated);
    setUserVote(value);

    Animated.parallel([
      Animated.timing(resultOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(barWidth, { toValue: 1, duration: 700, delay: 200, useNativeDriver: false }),
    ]).start();

    if (session?.user?.id) {
      await supabase.from("votes").insert({
        user_id: session.user.id,
        opinion_id: opinion.id,
        vote_value: value,
        voted_date: new Date().toISOString().split("T")[0],
      });
    }
  };

  const pressIn = (scale) =>
    Animated.spring(scale, { toValue: 0.93, useNativeDriver: true }).start();
  const pressOut = (scale) =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.next} />
        <Text style={[styles.loadingText, { color: colors.textSub }]}>Loading opinions...</Text>
      </View>
    );
  }

  if (opinions.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <Text style={[styles.emptyText, { color: colors.textSub }]}>No opinions yet.</Text>
      </View>
    );
  }

  const opinion = opinions[currentIndex];
  const agreePercent = votedOpinion?.total_votes > 0
    ? Math.round((votedOpinion.agree_count / votedOpinion.total_votes) * 100)
    : 50;
  const disagreePercent = 100 - agreePercent;
  const isMinority =
    (userVote === "agree" && agreePercent < 50) ||
    (userVote === "disagree" && disagreePercent < 50);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <StatusBar
        barStyle={scheme === "dark" ? "light-content" : "dark-content"}
        backgroundColor={colors.bg}
      />

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Live Opinion Feed</Text>
        <View style={[styles.liveIndicator, { backgroundColor: colors.agreeBg, borderColor: colors.agreeBorder }]}>
          <View style={[styles.liveDot, { backgroundColor: colors.agree }]} />
          <Text style={[styles.liveText, { color: colors.agree }]}>LIVE</Text>
        </View>
      </View>

      {/* Main layout — card + right sidebar */}
      <View style={styles.mainLayout}>

        {/* Card */}
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              opacity: cardOpacity,
              transform: [{ translateY: cardTranslateY }],
            },
          ]}
        >
          {/* Category pill */}
          <View style={[styles.categoryPill, { backgroundColor: colors.pill }]}>
            <Text style={[styles.categoryText, { color: colors.pillText }]}>
              {CATEGORY_LABELS[opinion?.category] ?? opinion?.category}
            </Text>
          </View>

          {/* Opinion text */}
          <Text style={[styles.opinionText, { color: colors.text }]}>
            {opinion?.text}
          </Text>

          {/* Vote buttons */}
          {!userVote && (
            <View style={styles.voteRow}>
              <TouchableOpacity
                style={[styles.voteBtn, { backgroundColor: colors.agreeBg, borderColor: colors.agreeBorder }]}
                onPress={() => handleVote("agree")}
                onPressIn={() => pressIn(nextBtnScale)}
                onPressOut={() => pressOut(nextBtnScale)}
                activeOpacity={0.85}
              >
                <Text style={styles.voteEmoji}>👍</Text>
                <Text style={[styles.voteBtnText, { color: colors.agree }]}>Agree</Text>
              </TouchableOpacity>

              <View style={{ width: 12 }} />

              <TouchableOpacity
                style={[styles.voteBtn, { backgroundColor: colors.disagreeBg, borderColor: colors.disagreeBorder }]}
                onPress={() => handleVote("disagree")}
                activeOpacity={0.85}
              >
                <Text style={styles.voteEmoji}>👎</Text>
                <Text style={[styles.voteBtnText, { color: colors.disagree }]}>Disagree</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Result section */}
          {userVote && (
            <Animated.View style={[styles.resultSection, { opacity: resultOpacity }]}>
              <View style={styles.verdictRow}>
                <Text style={styles.verdictEmoji}>{isMinority ? "🔥" : "✅"}</Text>
                <Text style={[styles.verdictText, { color: isMinority ? colors.minority : colors.agree }]}>
                  {isMinority ? "You are in the MINORITY" : "You are with the MAJORITY"}
                </Text>
              </View>

              <View style={styles.barSection}>
                <View style={styles.barLabelRow}>
                  <Text style={[styles.barLabel, { color: colors.agree }]}>👍 Agree</Text>
                  <Text style={[styles.barPercent, { color: colors.agree }]}>{agreePercent}%</Text>
                </View>
                <View style={[styles.barTrack, { backgroundColor: colors.bar }]}>
                  <Animated.View style={[styles.barFill, {
                    backgroundColor: colors.agree,
                    width: barWidth.interpolate({ inputRange: [0, 1], outputRange: ["0%", `${agreePercent}%`] }),
                  }]} />
                </View>
              </View>

              <View style={styles.barSection}>
                <View style={styles.barLabelRow}>
                  <Text style={[styles.barLabel, { color: colors.disagree }]}>👎 Disagree</Text>
                  <Text style={[styles.barPercent, { color: colors.disagree }]}>{disagreePercent}%</Text>
                </View>
                <View style={[styles.barTrack, { backgroundColor: colors.bar }]}>
                  <Animated.View style={[styles.barFill, {
                    backgroundColor: colors.disagree,
                    width: barWidth.interpolate({ inputRange: [0, 1], outputRange: ["0%", `${disagreePercent}%`] }),
                  }]} />
                </View>
              </View>

              <Text style={[styles.totalVotes, { color: colors.textMuted }]}>
                {votedOpinion?.total_votes?.toLocaleString()} votes worldwide
              </Text>
            </Animated.View>
          )}
        </Animated.View>

        {/* Right sidebar — TikTok style */}
        <View style={styles.sidebar}>
          {/* Next button */}
          <TouchableOpacity
            style={[styles.sideBtn, { backgroundColor: colors.nextBtn, borderColor: colors.nextBtnBorder }]}
            onPress={goNext}
            activeOpacity={0.8}
          >
            <Text style={styles.sideBtnIcon}>↑</Text>
            <Text style={[styles.sideBtnLabel, { color: colors.textSub }]}>Next</Text>
          </TouchableOpacity>

          {/* Vote count */}
          <View style={styles.sideInfo}>
            <Text style={styles.sideInfoEmoji}>🔥</Text>
            <Text style={[styles.sideInfoValue, { color: colors.text }]}>
              {(opinions[currentIndex]?.total_votes || 0).toLocaleString()}
            </Text>
            <Text style={[styles.sideInfoLabel, { color: colors.textSub }]}>votes</Text>
          </View>

          {/* Progress */}
          <View style={styles.sideInfo}>
            <Text style={styles.sideInfoEmoji}>📋</Text>
            <Text style={[styles.sideInfoValue, { color: colors.text }]}>
              {currentIndex + 1}/{opinions.length}
            </Text>
            <Text style={[styles.sideInfoLabel, { color: colors.textSub }]}>cards</Text>
          </View>
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + 12 : 56,
  },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 16, fontSize: 14 },
  emptyText: { fontSize: 15 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: "700", letterSpacing: -0.5 },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  // Main layout
  mainLayout: {
    flex: 1,
    flexDirection: "row",
    paddingLeft: 16,
    paddingRight: 8,
    paddingBottom: 16,
    gap: 8,
  },
  // Card
  card: {
    flex: 1,
    borderRadius: 28,
    borderWidth: 1,
    padding: 28,
    justifyContent: "center",
  },
  categoryPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 20,
  },
  categoryText: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase" },
  opinionText: {
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 34,
    letterSpacing: -0.5,
    marginBottom: 36,
  },
  voteRow: { flexDirection: "row" },
  voteBtn: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1.5,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  voteEmoji: { fontSize: 28 },
  voteBtnText: { fontSize: 14, fontWeight: "700" },
  // Result
  resultSection: { gap: 4 },
  verdictRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 18 },
  verdictEmoji: { fontSize: 20 },
  verdictText: { fontSize: 16, fontWeight: "800", letterSpacing: -0.3, flex: 1 },
  barSection: { marginBottom: 12 },
  barLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  barLabel: { fontSize: 13, fontWeight: "600" },
  barPercent: { fontSize: 13, fontWeight: "700" },
  barTrack: { height: 10, borderRadius: 5, overflow: "hidden" },
  barFill: { height: 10, borderRadius: 5 },
  totalVotes: { fontSize: 11, textAlign: "center", marginTop: 8 },
  // Sidebar
  sidebar: {
    width: 64,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingBottom: 20,
  },
  sideBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  sideBtnIcon: { fontSize: 20, color: "#7C3AED", fontWeight: "700" },
  sideBtnLabel: { fontSize: 9, fontWeight: "600" },
  sideInfo: { alignItems: "center", gap: 2 },
  sideInfoEmoji: { fontSize: 18 },
  sideInfoValue: { fontSize: 12, fontWeight: "700" },
  sideInfoLabel: { fontSize: 9 },
});
