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

const { width, height } = Dimensions.get("window");

// ─── Colour tokens ───────────────────────────────────────────
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
    skip: "#2A2A3A",
    skipText: "#5A5A7A",
    pill: "#1A1A28",
    pillText: "#5A5A7A",
    minority: "#F59E0B",
    bar: "#1E1E2E",
    barAgree: "#22C55E",
    barDisagree: "#EF4444",
    next: "#7C3AED",
    nextText: "#FFFFFF",
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
    skip: "#F0EFF8",
    skipText: "#9A99AE",
    pill: "#F0EFF8",
    pillText: "#9A99AE",
    minority: "#D97706",
    bar: "#F0EFF8",
    barAgree: "#16A34A",
    barDisagree: "#DC2626",
    next: "#7C3AED",
    nextText: "#FFFFFF",
  },
};

const CATEGORY_LABELS = {
  love: "Love",
  money: "Money",
  life: "Life",
  tech: "Tech",
  society: "Society",
};

// ─── Result card shown after voting ──────────────────────────
function ResultCard({ opinion, userVote, onNext, colors }) {
  const agreePercent = opinion.total_votes > 0
    ? Math.round((opinion.agree_count / opinion.total_votes) * 100)
    : 50;
  const disagreePercent = 100 - agreePercent;
  const isMinority =
    (userVote === "agree" && agreePercent < 50) ||
    (userVote === "disagree" && disagreePercent < 50);

  const barWidth = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(barWidth, {
        toValue: 1,
        duration: 700,
        delay: 200,
        useNativeDriver: false,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: fadeIn }]}>
      {/* Opinion text */}
      <Text style={[styles.resultOpinionText, { color: colors.textSub }]} numberOfLines={2}>
        "{opinion.text}"
      </Text>

      {/* Minority / majority label */}
      <View style={styles.verdictRow}>
        <Text style={[styles.verdictEmoji]}>
          {isMinority ? "🔥" : "✅"}
        </Text>
        <Text style={[styles.verdictText, { color: isMinority ? colors.minority : colors.agree }]}>
          {isMinority ? "You are in the MINORITY" : "You are with the MAJORITY"}
        </Text>
      </View>

      {/* Agree bar */}
      <View style={styles.barSection}>
        <View style={[styles.barTrack, { backgroundColor: colors.bar }]}>
          <Animated.View
            style={[
              styles.barFill,
              {
                backgroundColor: colors.barAgree,
                width: barWidth.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", `${agreePercent}%`],
                }),
              },
            ]}
          />
        </View>
        <View style={styles.barLabelRow}>
          <Text style={[styles.barLabel, { color: colors.agree }]}>
            👍 Agree · {agreePercent}%
          </Text>
          <Text style={[styles.barCount, { color: colors.textSub }]}>
            {opinion.agree_count.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Disagree bar */}
      <View style={styles.barSection}>
        <View style={[styles.barTrack, { backgroundColor: colors.bar }]}>
          <Animated.View
            style={[
              styles.barFill,
              {
                backgroundColor: colors.barDisagree,
                width: barWidth.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", `${disagreePercent}%`],
                }),
              },
            ]}
          />
        </View>
        <View style={styles.barLabelRow}>
          <Text style={[styles.barLabel, { color: colors.disagree }]}>
            👎 Disagree · {disagreePercent}%
          </Text>
          <Text style={[styles.barCount, { color: colors.textSub }]}>
            {opinion.disagree_count.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Total votes */}
      <Text style={[styles.totalVotes, { color: colors.textMuted }]}>
        {opinion.total_votes.toLocaleString()} votes worldwide
      </Text>

      {/* Next button */}
      <TouchableOpacity
        style={[styles.nextBtn, { backgroundColor: colors.next }]}
        onPress={onNext}
        activeOpacity={0.85}
      >
        <Text style={[styles.nextBtnText, { color: colors.nextText }]}>
          Next Opinion →
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Single opinion vote card ─────────────────────────────────
function OpinionCard({ opinion, onVote, onSkip, colors }) {
  const scaleAgree = useRef(new Animated.Value(1)).current;
  const scaleDisagree = useRef(new Animated.Value(1)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslate = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(cardTranslate, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
    ]).start();
  }, [opinion.id]);

  const pressIn = (scale) =>
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }).start();
  const pressOut = (scale) =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

  const handleVote = (value) => {
    Animated.sequence([
      Animated.timing(cardOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onVote(value));
  };

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          opacity: cardOpacity,
          transform: [{ translateY: cardTranslate }],
        },
      ]}
    >
      {/* Category pill */}
      <View style={[styles.categoryPill, { backgroundColor: colors.pill }]}>
        <Text style={[styles.categoryText, { color: colors.pillText }]}>
          {CATEGORY_LABELS[opinion.category] ?? opinion.category}
        </Text>
      </View>

      {/* Opinion text */}
      <Text style={[styles.opinionText, { color: colors.text }]}>
        {opinion.text}
      </Text>

      {/* Vote buttons */}
      <View style={styles.voteRow}>
        <Animated.View style={{ transform: [{ scale: scaleAgree }], flex: 1 }}>
          <TouchableOpacity
            style={[styles.voteBtn, styles.agreeBtn, { backgroundColor: colors.agreeBg, borderColor: colors.agreeBorder }]}
            onPress={() => handleVote("agree")}
            onPressIn={() => pressIn(scaleAgree)}
            onPressOut={() => pressOut(scaleAgree)}
            activeOpacity={1}
          >
            <Text style={styles.voteEmoji}>👍</Text>
            <Text style={[styles.voteBtnText, { color: colors.agree }]}>Agree</Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={{ width: 12 }} />

        <Animated.View style={{ transform: [{ scale: scaleDisagree }], flex: 1 }}>
          <TouchableOpacity
            style={[styles.voteBtn, styles.disagreeBtn, { backgroundColor: colors.disagreeBg, borderColor: colors.disagreeBorder }]}
            onPress={() => handleVote("disagree")}
            onPressIn={() => pressIn(scaleDisagree)}
            onPressOut={() => pressOut(scaleDisagree)}
            activeOpacity={1}
          >
            <Text style={styles.voteEmoji}>👎</Text>
            <Text style={[styles.voteBtnText, { color: colors.disagree }]}>Disagree</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Skip */}
      <TouchableOpacity onPress={onSkip} style={styles.skipBtn}>
        <Text style={[styles.skipText, { color: colors.skipText }]}>Skip →</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main Feed Screen ─────────────────────────────────────────
export default function FeedScreen() {
  const scheme = useColorScheme();
  const colors = palette[scheme === "dark" ? "dark" : "light"];

  const [opinions, setOpinions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userVote, setUserVote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [votedOpinion, setVotedOpinion] = useState(null);

  // ── Fetch approved opinions ──────────────────────────────
  useEffect(() => {
    fetchOpinions();
  }, []);

  // ── Supabase Realtime: live vote count updates ───────────
  useEffect(() => {
    const channel = supabase
      .channel("opinions-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "opinions" },
        (payload) => {
          setOpinions((prev) =>
            prev.map((op) =>
              op.id === payload.new.id ? { ...op, ...payload.new } : op
            )
          );
          setVotedOpinion((prev) =>
            prev?.id === payload.new.id ? { ...prev, ...payload.new } : prev
          );
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const fetchOpinions = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("opinions")
        .select("*")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(30);

      if (fetchError) throw fetchError;

      // Shuffle so feed feels fresh every session
      const shuffled = [...data].sort(() => Math.random() - 0.5);
      setOpinions(shuffled);
    } catch (err) {
      setError("Could not load opinions. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  // ── Handle vote ──────────────────────────────────────────
  const handleVote = async (value) => {
    const opinion = opinions[currentIndex];
    if (!opinion) return;

    // Optimistically update local counts
    const updated = {
      ...opinion,
      agree_count: value === "agree" ? opinion.agree_count + 1 : opinion.agree_count,
      disagree_count: value === "disagree" ? opinion.disagree_count + 1 : opinion.disagree_count,
      total_votes: opinion.total_votes + 1,
    };

    setVotedOpinion(updated);
    setUserVote(value);

    // Write to Supabase
    // The DB trigger handles updating opinion counts automatically
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("votes").insert({
        user_id: user.id,
        opinion_id: opinion.id,
        vote_value: value,
        voted_date: new Date().toISOString().split("T")[0],
      });
      // Note: if the user already voted today (unique constraint),
      // Supabase will return a 409 conflict — safe to ignore silently
    }
  };

  // ── Move to next opinion ─────────────────────────────────
  const handleNext = () => {
    setUserVote(null);
    setVotedOpinion(null);
    setCurrentIndex((prev) => {
      const next = prev + 1;
      // Reload when we reach the end
      if (next >= opinions.length) {
        fetchOpinions();
        return 0;
      }
      return next;
    });
  };

  const handleSkip = () => handleNext();

  // ── Render states ────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.next} />
        <Text style={[styles.loadingText, { color: colors.textSub }]}>
          Loading opinions...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <Text style={[styles.errorText, { color: colors.disagree }]}>{error}</Text>
        <TouchableOpacity style={[styles.nextBtn, { backgroundColor: colors.next, marginTop: 20 }]} onPress={fetchOpinions}>
          <Text style={[styles.nextBtnText, { color: colors.nextText }]}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (opinions.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <Text style={[styles.emptyText, { color: colors.textSub }]}>
          No opinions yet. Be the first to create one!
        </Text>
      </View>
    );
  }

  const currentOpinion = opinions[currentIndex];

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <StatusBar
        barStyle={scheme === "dark" ? "light-content" : "dark-content"}
        backgroundColor={colors.bg}
      />

      {/* Header */}
<View style={styles.header}>
  <Text style={[styles.headerTitle, { color: colors.text }]}>
    Live Opinion Feed
  </Text>
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
    <View style={[styles.liveIndicator, { backgroundColor: colors.agreeBg, borderColor: colors.agreeBorder }]}>
      <View style={[styles.liveDot, { backgroundColor: colors.agree }]} />
      <Text style={[styles.liveText, { color: colors.agree }]}>LIVE</Text>
    </View>
    <TouchableOpacity
      onPress={async () => { await supabase.auth.signOut(); }}
      style={[styles.logoutBtn, { backgroundColor: colors.pill }]}
    >
      <Text style={[styles.logoutText, { color: colors.textSub }]}>Log out</Text>
    </TouchableOpacity>
  </View>
</View>

      {/* Progress indicator */}
      <View style={styles.progressRow}>
        <Text style={[styles.progressText, { color: colors.textMuted }]}>
          {currentIndex + 1} / {opinions.length}
        </Text>
        <View style={[styles.progressTrack, { backgroundColor: colors.bar }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: colors.next,
                width: `${((currentIndex + 1) / opinions.length) * 100}%`,
              },
            ]}
          />
        </View>
      </View>

      {/* Main content area */}
      <View style={styles.cardArea}>
        {userVote && votedOpinion ? (
          <ResultCard
            opinion={votedOpinion}
            userVote={userVote}
            onNext={handleNext}
            colors={colors}
          />
        ) : (
          <OpinionCard
            key={currentOpinion.id}
            opinion={currentOpinion}
            onVote={handleVote}
            onSkip={handleSkip}
            colors={colors}
          />
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + 12 : 56,
    paddingHorizontal: 20,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  // Progress
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  progressText: {
    fontSize: 11,
    fontWeight: "500",
    width: 40,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
  },
  // Card area
  cardArea: {
    flex: 1,
    justifyContent: "center",
  },
  // Opinion card
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  categoryPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 20,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  opinionText: {
    fontSize: 26,
    fontWeight: "700",
    lineHeight: 34,
    letterSpacing: -0.5,
    marginBottom: 36,
    minHeight: 100,
  },
  voteRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  voteBtn: {
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  voteEmoji: {
    fontSize: 28,
  },
  voteBtnText: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  skipBtn: {
    alignItems: "center",
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  // Result card
  resultCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  resultOpinionText: {
    fontSize: 14,
    fontStyle: "italic",
    marginBottom: 20,
    lineHeight: 20,
  },
  verdictRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 24,
  },
  verdictEmoji: {
    fontSize: 20,
  },
  verdictText: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  barSection: {
    marginBottom: 16,
  },
  barTrack: {
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
    marginBottom: 6,
  },
  barFill: {
    height: 10,
    borderRadius: 5,
  },
  barLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  barLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  barCount: {
    fontSize: 12,
  },
  totalVotes: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 24,
  },
  nextBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  nextBtnText: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  // Loading / error / empty
  loadingText: {
    marginTop: 16,
    fontSize: 14,
  },
  errorText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  }
});
