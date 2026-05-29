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

const { width: SW, height: SH } = Dimensions.get("window");

// 9:16 card dimensions — card height = available screen height, width = height * 9/16
const CARD_HEIGHT = SH - (Platform.OS === "android" ? 120 : 100);
const CARD_WIDTH = Math.min(CARD_HEIGHT * (9 / 16), SW - 80);

const palette = {
  dark: {
    bg: "#0A0A0F",
    card: "#13131A",
    cardBorder: "#2A2A3A",
    text: "#F0EFF8",
    textSub: "#6B6A7E",
    textMuted: "#3D3C50",
    agree: "#22C55E",
    agreeBg: "#052010",
    agreeBorder: "#0D4020",
    disagree: "#EF4444",
    disagreeBg: "#1A0505",
    disagreeBorder: "#3D1010",
    pill: "#1E1E2E",
    pillText: "#6B6A7E",
    minority: "#F59E0B",
    bar: "#1E1E2E",
    nextBtn: "#1E1E2E",
    nextBtnBorder: "#3A3A5A",
    nextIcon: "#A78BFA",
  },
  light: {
    bg: "#F0EFF8",
    card: "#FFFFFF",
    cardBorder: "#E0DEFA",
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
    nextBtn: "#FFFFFF",
    nextBtnBorder: "#E0DEFA",
    nextIcon: "#7C3AED",
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
  const resultTranslateY = useRef(new Animated.Value(100)).current;
  const btnsOpacity = useRef(new Animated.Value(1)).current;
  const btnsTranslateY = useRef(new Animated.Value(0)).current;
  const barWidth = useRef(new Animated.Value(0)).current;
  const nextScale = useRef(new Animated.Value(1)).current;

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
      Animated.timing(cardOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(cardTranslateY, { toValue: -80, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setUserVote(null);
      setVotedOpinion(null);
      barWidth.setValue(0);
      resultOpacity.setValue(0);
      resultTranslateY.setValue(100);
      btnsOpacity.setValue(1);
      btnsTranslateY.setValue(0);
      cardTranslateY.setValue(80);
      cardOpacity.setValue(0);

      setCurrentIndex((prev) => {
        const next = prev + 1;
        if (next >= opinions.length) { fetchOpinions(); return 0; }
        return next;
      });

      Animated.parallel([
        Animated.spring(cardTranslateY, { toValue: 0, tension: 70, friction: 11, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
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
      Animated.timing(btnsOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(btnsTranslateY, { toValue: 50, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      Animated.parallel([
        Animated.timing(resultOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(resultTranslateY, { toValue: 0, tension: 70, friction: 10, useNativeDriver: true }),
        Animated.timing(barWidth, { toValue: 1, duration: 700, delay: 150, useNativeDriver: false }),
      ]).start();
    });

    if (session?.user?.id) {
      await supabase.from("votes").insert({
        user_id: session.user.id,
        opinion_id: opinion.id,
        vote_value: value,
        voted_date: new Date().toISOString().split("T")[0],
      });
    }
  };

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={[{ color: colors.textSub, fontSize: 14, marginTop: 16 }]}>Loading opinions...</Text>
      </View>
    );
  }

  if (opinions.length === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }]}>
        <Text style={[{ color: colors.textSub, fontSize: 15 }]}>No opinions yet.</Text>
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

      {/* Centered layout */}
      <View style={styles.layout}>

        {/* 9:16 Card */}
        <Animated.View
          style={[
            styles.card,
            {
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              opacity: cardOpacity,
              transform: [{ translateY: cardTranslateY }],
            },
          ]}
        >
          {/* Top row */}
          <View style={styles.cardTop}>
            <View style={[styles.categoryPill, { backgroundColor: colors.pill }]}>
              <Text style={[styles.categoryText, { color: colors.pillText }]}>
                {CATEGORY_LABELS[opinion?.category] ?? opinion?.category}
              </Text>
            </View>
            <View style={styles.topRight}>
              <View style={[styles.liveIndicator, { backgroundColor: colors.agreeBg, borderColor: colors.agreeBorder }]}>
                <View style={[styles.liveDot, { backgroundColor: colors.agree }]} />
                <Text style={[styles.liveText, { color: colors.agree }]}>LIVE</Text>
              </View>
              <Text style={[styles.counter, { color: colors.textMuted }]}>
                {currentIndex + 1}/{opinions.length}
              </Text>
            </View>
          </View>

          {/* Center — opinion text */}
          <View style={styles.centerArea}>
            <Text style={[styles.opinionText, { color: colors.text }]}>
              {opinion?.text}
            </Text>
            <Text style={[styles.voteCount, { color: colors.textMuted }]}>
              🔥 {(opinion?.total_votes || 0).toLocaleString()} votes
            </Text>
          </View>

          {/* Bottom — buttons or result */}
          <View style={styles.cardBottom}>
            {/* Vote buttons */}
            {!userVote && (
              <Animated.View
                style={[
                  styles.voteRow,
                  {
                    opacity: btnsOpacity,
                    transform: [{ translateY: btnsTranslateY }],
                  },
                ]}
              >
                <TouchableOpacity
                  style={[styles.voteBtn, { backgroundColor: colors.agreeBg, borderColor: colors.agreeBorder }]}
                  onPress={() => handleVote("agree")}
                  activeOpacity={0.85}
                >
                  <Text style={styles.voteEmoji}>👍</Text>
                  <Text style={[styles.voteBtnText, { color: colors.agree }]}>Agree</Text>
                </TouchableOpacity>

                <View style={{ width: 10 }} />

                <TouchableOpacity
                  style={[styles.voteBtn, { backgroundColor: colors.disagreeBg, borderColor: colors.disagreeBorder }]}
                  onPress={() => handleVote("disagree")}
                  activeOpacity={0.85}
                >
                  <Text style={styles.voteEmoji}>👎</Text>
                  <Text style={[styles.voteBtnText, { color: colors.disagree }]}>Disagree</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* Result */}
            {userVote && (
              <Animated.View
                style={[
                  styles.resultSection,
                  {
                    opacity: resultOpacity,
                    transform: [{ translateY: resultTranslateY }],
                  },
                ]}
              >
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
          </View>
        </Animated.View>

        {/* Right sidebar — next button */}
        <View style={styles.sidebar}>
          <TouchableOpacity
            onPress={goNext}
            onPressIn={() => Animated.spring(nextScale, { toValue: 0.85, useNativeDriver: true }).start()}
            onPressOut={() => Animated.spring(nextScale, { toValue: 1, useNativeDriver: true }).start()}
            activeOpacity={1}
          >
            <Animated.View
              style={[
                styles.nextBtn,
                {
                  backgroundColor: colors.nextBtn,
                  borderColor: colors.nextBtnBorder,
                  transform: [{ scale: nextScale }],
                },
              ]}
            >
              <Text style={[styles.nextIcon, { color: colors.nextIcon }]}>↑</Text>
            </Animated.View>
          </TouchableOpacity>
          <Text style={[styles.nextLabel, { color: colors.textMuted }]}>Next</Text>
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0,
  },
  layout: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 12,
  },
  card: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 22,
    flexDirection: "column",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  liveDot: { width: 5, height: 5, borderRadius: 3 },
  liveText: { fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  counter: { fontSize: 11, fontWeight: "500" },
  centerArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 4,
  },
  opinionText: {
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 32,
    letterSpacing: -0.5,
    textAlign: "center",
    marginBottom: 14,
  },
  voteCount: {
    fontSize: 12,
    fontWeight: "500",
  },
  cardBottom: {
    gap: 0,
  },
  voteRow: {
    flexDirection: "row",
  },
  voteBtn: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  voteEmoji: { fontSize: 26 },
  voteBtnText: { fontSize: 13, fontWeight: "700" },
  resultSection: { gap: 2 },
  verdictRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  verdictEmoji: { fontSize: 18 },
  verdictText: { fontSize: 14, fontWeight: "800", flex: 1 },
  barSection: { marginBottom: 10 },
  barLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  barLabel: { fontSize: 11, fontWeight: "600" },
  barPercent: { fontSize: 11, fontWeight: "700" },
  barTrack: { height: 9, borderRadius: 5, overflow: "hidden" },
  barFill: { height: 9, borderRadius: 5 },
  totalVotes: { fontSize: 10, textAlign: "center", marginTop: 6 },
  sidebar: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  nextBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  nextIcon: { fontSize: 22, fontWeight: "700" },
  nextLabel: { fontSize: 10, fontWeight: "500" },
});
