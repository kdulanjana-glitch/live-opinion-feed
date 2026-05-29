import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SWIPE_THRESHOLD = 80;

const palette = {
  dark: {
    bg: "#0A0A0F",
    card: "#13131A",
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
    overlay: "rgba(0,0,0,0.85)",
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
    overlay: "rgba(255,255,255,0.95)",
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

  // Animation values
  const translateY = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const agreeScale = useRef(new Animated.Value(1)).current;
  const disagreeScale = useRef(new Animated.Value(1)).current;
  const barWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => { fetchOpinions(); }, []);

  // Realtime vote updates
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
    // Animate card out upward
    Animated.parallel([
      Animated.timing(translateY, { toValue: -SCREEN_HEIGHT, duration: 300, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      // Reset state
      setUserVote(null);
      setVotedOpinion(null);
      barWidth.setValue(0);
      resultOpacity.setValue(0);
      translateY.setValue(SCREEN_HEIGHT * 0.3);
      cardOpacity.setValue(0);

      setCurrentIndex((prev) => {
        const next = prev + 1;
        if (next >= opinions.length) {
          fetchOpinions();
          return 0;
        }
        return next;
      });

      // Animate new card in from bottom
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    });
  };

  const showResult = (opinion, vote) => {
    const updated = {
      ...opinion,
      agree_count: vote === "agree" ? opinion.agree_count + 1 : opinion.agree_count,
      disagree_count: vote === "disagree" ? opinion.disagree_count + 1 : opinion.disagree_count,
      total_votes: opinion.total_votes + 1,
    };
    setVotedOpinion(updated);
    setUserVote(vote);

    // Animate buttons out, result in
    Animated.parallel([
      Animated.timing(agreeScale, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(disagreeScale, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      Animated.parallel([
        Animated.timing(resultOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(barWidth, { toValue: 1, duration: 700, delay: 100, useNativeDriver: false }),
      ]).start();
    });
  };

  const handleVote = async (value) => {
    if (userVote) return;
    const opinion = opinions[currentIndex];
    if (!opinion) return;

    showResult(opinion, value);

    // Reset button scales for next card
    agreeScale.setValue(1);
    disagreeScale.setValue(1);

    // Save to database
    if (session?.user?.id) {
      await supabase.from("votes").insert({
        user_id: session.user.id,
        opinion_id: opinion.id,
        vote_value: value,
        voted_date: new Date().toISOString().split("T")[0],
      });
    }
  };

  // Pan responder for swipe up
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dy) > 10 && gesture.dy < 0,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy < 0) {
          translateY.setValue(gesture.dy * 0.4);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy < -SWIPE_THRESHOLD) {
          goNext();
        } else {
          Animated.spring(translateY, { toValue: 0, tension: 100, friction: 10, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

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

      {/* Swipe hint */}
      {!userVote && (
        <Text style={[styles.swipeHint, { color: colors.textMuted }]}>
          swipe up to skip ↑
        </Text>
      )}

      {/* Full screen card */}
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
            opacity: cardOpacity,
            transform: [{ translateY }],
          },
        ]}
        {...panResponder.panHandlers}
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

        {/* Vote buttons — hidden after vote */}
        {!userVote && (
          <View style={styles.voteRow}>
            <Animated.View style={{ transform: [{ scale: agreeScale }], flex: 1 }}>
              <TouchableOpacity
                style={[styles.voteBtn, { backgroundColor: colors.agreeBg, borderColor: colors.agreeBorder }]}
                onPress={() => handleVote("agree")}
                onPressIn={() => pressIn(agreeScale)}
                onPressOut={() => pressOut(agreeScale)}
                activeOpacity={1}
              >
                <Text style={styles.voteEmoji}>👍</Text>
                <Text style={[styles.voteBtnText, { color: colors.agree }]}>Agree</Text>
              </TouchableOpacity>
            </Animated.View>
            <View style={{ width: 12 }} />
            <Animated.View style={{ transform: [{ scale: disagreeScale }], flex: 1 }}>
              <TouchableOpacity
                style={[styles.voteBtn, { backgroundColor: colors.disagreeBg, borderColor: colors.disagreeBorder }]}
                onPress={() => handleVote("disagree")}
                onPressIn={() => pressIn(disagreeScale)}
                onPressOut={() => pressOut(disagreeScale)}
                activeOpacity={1}
              >
                <Text style={styles.voteEmoji}>👎</Text>
                <Text style={[styles.voteBtnText, { color: colors.disagree }]}>Disagree</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}

        {/* Result — shown after vote */}
        {userVote && (
          <Animated.View style={[styles.resultSection, { opacity: resultOpacity }]}>
            {/* Verdict */}
            <View style={styles.verdictRow}>
              <Text style={styles.verdictEmoji}>{isMinority ? "🔥" : "✅"}</Text>
              <Text style={[styles.verdictText, { color: isMinority ? colors.minority : colors.agree }]}>
                {isMinority ? "You are in the MINORITY" : "You are with the MAJORITY"}
              </Text>
            </View>

            {/* Agree bar */}
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

            {/* Disagree bar */}
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

            {/* Total votes */}
            <Text style={[styles.totalVotes, { color: colors.textMuted }]}>
              {votedOpinion?.total_votes?.toLocaleString()} votes worldwide
            </Text>

            {/* Swipe hint after vote */}
            <Text style={[styles.swipeHintAfter, { color: colors.textMuted }]}>
              swipe up for next ↑
            </Text>
          </Animated.View>
        )}
      </Animated.View>
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
    marginBottom: 8,
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
  swipeHint: {
    textAlign: "center",
    fontSize: 12,
    marginBottom: 8,
  },
  card: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
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
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 36,
    letterSpacing: -0.5,
    marginBottom: 40,
  },
  voteRow: { flexDirection: "row" },
  voteBtn: {
    borderRadius: 18,
    borderWidth: 1.5,
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  voteEmoji: { fontSize: 30 },
  voteBtnText: { fontSize: 15, fontWeight: "700" },
  resultSection: { gap: 4 },
  verdictRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20 },
  verdictEmoji: { fontSize: 22 },
  verdictText: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3, flex: 1 },
  barSection: { marginBottom: 14 },
  barLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  barLabel: { fontSize: 13, fontWeight: "600" },
  barPercent: { fontSize: 13, fontWeight: "700" },
  barTrack: { height: 12, borderRadius: 6, overflow: "hidden" },
  barFill: { height: 12, borderRadius: 6 },
  totalVotes: { fontSize: 12, textAlign: "center", marginTop: 8 },
  swipeHintAfter: { fontSize: 12, textAlign: "center", marginTop: 16 },
});
