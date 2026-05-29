import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  KeyboardAvoidingView, Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";

const { width: SW, height: SH } = Dimensions.get("window");
const CARD_HEIGHT = SH - (Platform.OS === "android" ? 120 : 100);
const CARD_WIDTH = Math.min(CARD_HEIGHT * (9 / 16), SW - 40);

const palette = {
  dark: {
    bg: "#0A0A0F", card: "#13131A", cardBorder: "#2A2A3A",
    text: "#F0EFF8", textSub: "#6B6A7E", textMuted: "#3D3C50",
    agree: "#22C55E", agreeBg: "#0A1A0F", agreeBorder: "#0D4020", agreeDark: "#052010",
    disagree: "#EF4444", disagreeBg: "#1A0A0A", disagreeBorder: "#3D1010", disagreeDark: "#1A0505",
    pill: "#2A2A3A", pillText: "#A0A0B8", pillBorder: "#3A3A5A",
    minority: "#F59E0B", bar: "#1E1E2E",
    sideBtn: "#1E1E2E", sideBtnBorder: "#2A2A3A", nextIcon: "#A78BFA",
    liked: "#EF4444", saved: "#F59E0B",
    modalBg: "#13131A", modalBorder: "#2A2A3A",
    input: "#1E1E2E", inputBorder: "#3A3A5A",
    liveGreen: "#22C55E", liveBg: "#052010", liveBorder: "#0D4020",
    categoryBg: "#2D1B69", categoryText: "#C4B5FD", categoryBorder: "#4C1D95",
  },
  light: {
    bg: "#F0EFF8", card: "#FFFFFF", cardBorder: "#E0DEFA",
    text: "#0D0C1A", textSub: "#7A798E", textMuted: "#BCBBCE",
    agree: "#16A34A", agreeBg: "#F0FDF4", agreeBorder: "#86EFAC", agreeDark: "#DCFCE7",
    disagree: "#DC2626", disagreeBg: "#FFF5F5", disagreeBorder: "#FCA5A5", disagreeDark: "#FFE4E4",
    pill: "#EDE9FE", pillText: "#5B21B6", pillBorder: "#C4B5FD",
    minority: "#D97706", bar: "#F0EFF8",
    sideBtn: "#F5F4FA", sideBtnBorder: "#E0DEFA", nextIcon: "#7C3AED",
    liked: "#EF4444", saved: "#D97706",
    modalBg: "#FFFFFF", modalBorder: "#E0DEFA",
    input: "#F5F4FA", inputBorder: "#E0DEFA",
    liveGreen: "#16A34A", liveBg: "#F0FDF4", liveBorder: "#BBF7D0",
    categoryBg: "#EDE9FE", categoryText: "#5B21B6", categoryBorder: "#C4B5FD",
  },
};

const CATEGORY_LABELS = {
  love: { label: "Love", emoji: "❤️" },
  money: { label: "Money", emoji: "💰" },
  life: { label: "Life", emoji: "🌱" },
  tech: { label: "Tech", emoji: "💻" },
  society: { label: "Society", emoji: "🌍" },
};

function CommentModal({ visible, onClose, opinionId, session, colors }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible && opinionId) fetchComments();
  }, [visible, opinionId]);

  const fetchComments = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("opinion_comments")
      .select("*, users(username)")
      .eq("opinion_id", opinionId)
      .order("created_at", { ascending: false })
      .limit(50);
    setComments(data || []);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!newComment.trim() || !session?.user?.id) return;
    setSubmitting(true);
    await supabase.from("opinion_comments").insert({
      user_id: session.user.id,
      opinion_id: opinionId,
      text: newComment.trim(),
    });
    setNewComment("");
    await fetchComments();
    setSubmitting(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={cs.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ width: "100%", maxWidth: 480 }}>
          <View style={[cs.sheet, { backgroundColor: colors.modalBg, borderColor: colors.modalBorder }]}>
            <View style={[cs.handle, { backgroundColor: colors.sideBtnBorder }]} />
            <View style={cs.header}>
              <Text style={[cs.title, { color: colors.text }]}>Comments</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={[cs.close, { color: colors.textSub }]}>✕</Text>
              </TouchableOpacity>
            </View>
            {loading ? (
              <ActivityIndicator color="#7C3AED" style={{ marginVertical: 20 }} />
            ) : comments.length === 0 ? (
              <Text style={[cs.empty, { color: colors.textMuted }]}>No comments yet. Be the first!</Text>
            ) : (
              <ScrollView style={cs.list} showsVerticalScrollIndicator={false}>
                {comments.map((c) => (
                  <View key={c.id} style={cs.row}>
                    <View style={[cs.avatar, { backgroundColor: "#7C3AED" }]}>
                      <Text style={cs.avatarText}>{(c.users?.username || "?")[0].toUpperCase()}</Text>
                    </View>
                    <View style={cs.body}>
                      <Text style={[cs.user, { color: colors.textSub }]}>@{c.users?.username || "anonymous"}</Text>
                      <Text style={[cs.commentText, { color: colors.text }]}>{c.text}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
            <View style={[cs.inputRow, { borderTopColor: colors.modalBorder }]}>
              <TextInput
                style={[cs.input, { backgroundColor: colors.input, borderColor: colors.inputBorder, color: colors.text }]}
                placeholder="Add a comment..."
                placeholderTextColor={colors.textMuted}
                value={newComment}
                onChangeText={setNewComment}
                maxLength={300}
              />
              <TouchableOpacity
                style={[cs.send, { backgroundColor: newComment.trim() ? "#7C3AED" : colors.sideBtn }]}
                onPress={handleSubmit}
                disabled={submitting || !newComment.trim()}
              >
                <Text style={{ color: newComment.trim() ? "#fff" : colors.textMuted, fontSize: 16 }}>↑</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const cs = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end", alignItems: "center" },
  sheet: { width: "100%", borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 20, maxHeight: SH * 0.7 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 16, fontWeight: "700" },
  close: { fontSize: 18, padding: 4 },
  empty: { textAlign: "center", fontSize: 13, paddingVertical: 24 },
  list: { maxHeight: SH * 0.35 },
  row: { flexDirection: "row", gap: 10, marginBottom: 14, alignItems: "flex-start" },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  body: { flex: 1 },
  user: { fontSize: 11, marginBottom: 2 },
  commentText: { fontSize: 13, lineHeight: 18 },
  inputRow: { flexDirection: "row", gap: 8, borderTopWidth: 1, paddingTop: 12, marginTop: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13 },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});

export default function FeedScreen({ session }) {
  const scheme = useColorScheme();
  const colors = palette[scheme === "dark" ? "dark" : "light"];

  const [opinions, setOpinions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userVote, setUserVote] = useState(null);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Double tap refs — store last tap time
  const agreeTapTime = useRef(0);
  const disagreeTapTime = useRef(0);
  const DOUBLE_TAP_DELAY = 350;

  const cardOpacity = useRef(new Animated.Value(1)).current;
  const cardTranslateY = useRef(new Animated.Value(0)).current;
  const nextScale = useRef(new Animated.Value(1)).current;
  const likeScale = useRef(new Animated.Value(1)).current;
  const saveScale = useRef(new Animated.Value(1)).current;

  useEffect(() => { fetchOpinions(); }, []);

  useEffect(() => {
    if (opinions.length > 0 && session?.user?.id) checkUserActions();
  }, [currentIndex, opinions.length]);

  useEffect(() => {
    const channel = supabase.channel("opinions-rt")
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "opinions" },
        (payload) => setOpinions((prev) =>
          prev.map((op) => op.id === payload.new.id ? { ...op, ...payload.new } : op)
        )
      ).subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const fetchOpinions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("opinions").select("*, users(username)")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      setOpinions([...data].sort(() => Math.random() - 0.5));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const checkUserActions = async () => {
    if (!session?.user?.id || !opinions[currentIndex]) return;
    const opId = opinions[currentIndex].id;
    const today = new Date().toISOString().split("T")[0];

    const [voteRes, likeRes, saveRes] = await Promise.all([
      supabase.from("votes").select("vote_value").eq("user_id", session.user.id).eq("opinion_id", opId).eq("voted_date", today).maybeSingle(),
      supabase.from("opinion_likes").select("id").eq("user_id", session.user.id).eq("opinion_id", opId).maybeSingle(),
      supabase.from("opinion_saves").select("id").eq("user_id", session.user.id).eq("opinion_id", opId).maybeSingle(),
    ]);
    setUserVote(voteRes.data?.vote_value || null);
    setLiked(!!likeRes.data);
    setSaved(!!saveRes.data);
  };

  const goNext = () => {
    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(cardTranslateY, { toValue: -80, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setUserVote(null);
      setLiked(false);
      setSaved(false);
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

  // Double tap — only fires if two taps within DOUBLE_TAP_DELAY ms
  const handleAgreeTap = () => {
    if (userVote) return;
    const now = Date.now();
    if (now - agreeTapTime.current < DOUBLE_TAP_DELAY) {
      agreeTapTime.current = 0;
      handleVote("agree");
    } else {
      agreeTapTime.current = now;
    }
  };

  const handleDisagreeTap = () => {
    if (userVote) return;
    const now = Date.now();
    if (now - disagreeTapTime.current < DOUBLE_TAP_DELAY) {
      disagreeTapTime.current = 0;
      handleVote("disagree");
    } else {
      disagreeTapTime.current = now;
    }
  };

  const handleVote = async (value) => {
    if (userVote) return;
    const opinion = opinions[currentIndex];
    if (!opinion) return;
    setUserVote(value);
    setOpinions((prev) => prev.map((op) =>
      op.id === opinion.id ? {
        ...op,
        agree_count: value === "agree" ? op.agree_count + 1 : op.agree_count,
        disagree_count: value === "disagree" ? op.disagree_count + 1 : op.disagree_count,
        total_votes: op.total_votes + 1,
      } : op
    ));
    if (session?.user?.id) {
      await supabase.from("votes").insert({
        user_id: session.user.id,
        opinion_id: opinion.id,
        vote_value: value,
        voted_date: new Date().toISOString().split("T")[0],
      });
    }
  };

  const handleLike = async () => {
    if (!session?.user?.id) return;
    const opinion = opinions[currentIndex];
    Animated.sequence([
      Animated.spring(likeScale, { toValue: 1.4, useNativeDriver: true }),
      Animated.spring(likeScale, { toValue: 1, useNativeDriver: true }),
    ]).start();
    if (liked) {
      setLiked(false);
      await supabase.from("opinion_likes").delete().eq("user_id", session.user.id).eq("opinion_id", opinion.id);
    } else {
      setLiked(true);
      await supabase.from("opinion_likes").insert({ user_id: session.user.id, opinion_id: opinion.id });
    }
  };

  const handleSave = async () => {
    if (!session?.user?.id) return;
    const opinion = opinions[currentIndex];
    Animated.sequence([
      Animated.spring(saveScale, { toValue: 1.4, useNativeDriver: true }),
      Animated.spring(saveScale, { toValue: 1, useNativeDriver: true }),
    ]).start();
    if (saved) {
      setSaved(false);
      await supabase.from("opinion_saves").delete().eq("user_id", session.user.id).eq("opinion_id", opinion.id);
    } else {
      setSaved(true);
      await supabase.from("opinion_saves").insert({ user_id: session.user.id, opinion_id: opinion.id });
    }
  };

  if (loading) return (
    <View style={[styles.screen, { backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }]}>
      <ActivityIndicator size="large" color="#7C3AED" />
      <Text style={{ color: colors.textSub, fontSize: 14, marginTop: 16 }}>Loading opinions...</Text>
    </View>
  );

  if (opinions.length === 0) return (
    <View style={[styles.screen, { backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }]}>
      <Text style={{ color: colors.textSub, fontSize: 15 }}>No opinions yet.</Text>
    </View>
  );

  const opinion = opinions[currentIndex];
  const total = opinion?.total_votes || 0;
  const agreePercent = total > 0 ? Math.round((opinion.agree_count / total) * 100) : 50;
  const disagreePercent = 100 - agreePercent;
  const isMinority = (userVote === "agree" && agreePercent < 50) || (userVote === "disagree" && disagreePercent < 50);
  const catInfo = CATEGORY_LABELS[opinion?.category];

  // Creator avatar initial
  const creatorInitial = (opinion?.users?.username || opinion?.created_by || "?")[0].toUpperCase();

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={scheme === "dark" ? "light-content" : "dark-content"} backgroundColor={colors.bg} />
      <View style={styles.layout}>
        {/* 9:16 card with sidebar inside */}
        <Animated.View style={[
          styles.card,
          {
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
            opacity: cardOpacity,
            transform: [{ translateY: cardTranslateY }],
          },
        ]}>
          {/* Card content left side */}
          <View style={styles.cardContent}>
            {/* Top row */}
            <View style={styles.cardTop}>
              {/* Category pill — more visible */}
              <View style={[styles.categoryPill, { backgroundColor: colors.categoryBg, borderColor: colors.categoryBorder }]}>
                <Text style={styles.categoryEmoji}>{catInfo?.emoji}</Text>
                <Text style={[styles.categoryText, { color: colors.categoryText }]}>
                  {catInfo?.label ?? opinion?.category}
                </Text>
              </View>
              <View style={styles.topRight}>
                <View style={[styles.liveIndicator, { backgroundColor: colors.liveBg, borderColor: colors.liveBorder }]}>
                  <View style={[styles.liveDot, { backgroundColor: colors.liveGreen }]} />
                  <Text style={[styles.liveText, { color: colors.liveGreen }]}>LIVE</Text>
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
              {userVote && (
                <View style={styles.resultInfo}>
                  <Text style={[styles.totalVotesText, { color: colors.textMuted }]}>
                    🔥 {total.toLocaleString()} votes worldwide
                  </Text>
                  <Text style={[styles.verdictText, { color: isMinority ? colors.minority : colors.agree }]}>
                    {isMinority ? "You are in the MINORITY" : "You are with the MAJORITY"}
                  </Text>
                </View>
              )}
            </View>

            {/* Bottom — vote buttons */}
            <View style={styles.cardBottom}>
              <View style={styles.voteRow}>
                <TouchableOpacity
                  style={[
                    styles.voteBtn,
                    {
                      backgroundColor: userVote === "agree" ? colors.agreeDark : colors.agreeBg,
                      borderColor: colors.agreeBorder,
                      borderWidth: userVote === "agree" ? 2.5 : 1.5,
                    },
                  ]}
                  onPress={handleAgreeTap}
                  activeOpacity={0.85}
                >
                  <Text style={styles.voteEmoji}>👍</Text>
                  <Text style={[styles.voteBtnText, { color: colors.agree, fontWeight: userVote === "agree" ? "900" : "600" }]}>
                    {userVote ? `${agreePercent}%` : "Agree"}
                  </Text>
                </TouchableOpacity>

                <View style={{ width: 10 }} />

                <TouchableOpacity
                  style={[
                    styles.voteBtn,
                    {
                      backgroundColor: userVote === "disagree" ? colors.disagreeDark : colors.disagreeBg,
                      borderColor: colors.disagreeBorder,
                      borderWidth: userVote === "disagree" ? 2.5 : 1.5,
                    },
                  ]}
                  onPress={handleDisagreeTap}
                  activeOpacity={0.85}
                >
                  <Text style={styles.voteEmoji}>👎</Text>
                  <Text style={[styles.voteBtnText, { color: colors.disagree, fontWeight: userVote === "disagree" ? "900" : "600" }]}>
                    {userVote ? `${disagreePercent}%` : "Disagree"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Right sidebar — inside card, center-right */}
          <View style={styles.sidebar}>
            {/* Creator avatar */}
            <View style={styles.sideItem}>
              <View style={[styles.avatarBtn, { backgroundColor: "#7C3AED" }]}>
                <Text style={styles.avatarText}>{creatorInitial}</Text>
              </View>
            </View>

            {/* Like */}
            <View style={styles.sideItem}>
              <TouchableOpacity
                style={[styles.sideBtn, { backgroundColor: colors.sideBtn, borderColor: colors.sideBtnBorder }]}
                onPress={handleLike}
                activeOpacity={0.8}
              >
                <Animated.Text style={[styles.sideBtnIcon, { transform: [{ scale: likeScale }] }]}>
                  {liked ? "❤️" : "🤍"}
                </Animated.Text>
              </TouchableOpacity>
              <Text style={[styles.sideBtnCount, { color: colors.textMuted }]}>
                {(opinion?.like_count || 0).toLocaleString()}
              </Text>
            </View>

            {/* Comment */}
            <View style={styles.sideItem}>
              <TouchableOpacity
                style={[styles.sideBtn, { backgroundColor: colors.sideBtn, borderColor: colors.sideBtnBorder }]}
                onPress={() => setCommentOpen(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.sideBtnIcon}>💬</Text>
              </TouchableOpacity>
              <Text style={[styles.sideBtnCount, { color: colors.textMuted }]}>
                {(opinion?.comment_count || 0).toLocaleString()}
              </Text>
            </View>

            {/* Save */}
            <View style={styles.sideItem}>
              <TouchableOpacity
                style={[styles.sideBtn, { backgroundColor: colors.sideBtn, borderColor: colors.sideBtnBorder }]}
                onPress={handleSave}
                activeOpacity={0.8}
              >
                <Animated.Text style={[styles.sideBtnIcon, { transform: [{ scale: saveScale }] }]}>
                  {saved ? "🔖" : "🏷️"}
                </Animated.Text>
              </TouchableOpacity>
              <Text style={[styles.sideBtnCount, { color: colors.textMuted }]}>
                {(opinion?.save_count || 0).toLocaleString()}
              </Text>
            </View>

            {/* Share */}
            <View style={styles.sideItem}>
              <TouchableOpacity
                style={[styles.sideBtn, { backgroundColor: colors.sideBtn, borderColor: colors.sideBtnBorder }]}
                onPress={() => {
                  try {
                    const url = typeof window !== "undefined"
                      ? window.location.href
                      : "https://live-opinion-feed.vercel.app";
                    if (typeof navigator !== "undefined" && navigator.share) {
                      navigator.share({ title: opinion?.text, url });
                    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
                      navigator.clipboard.writeText(url);
                    }
                  } catch (e) {}
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.sideBtnIcon}>↗️</Text>
              </TouchableOpacity>
              <Text style={[styles.sideBtnCount, { color: colors.textMuted }]}>Share</Text>
            </View>

            {/* Next ↑ */}
            <View style={styles.sideItem}>
              <TouchableOpacity
                onPress={goNext}
                onPressIn={() => Animated.spring(nextScale, { toValue: 0.85, useNativeDriver: true }).start()}
                onPressOut={() => Animated.spring(nextScale, { toValue: 1, useNativeDriver: true }).start()}
                activeOpacity={1}
              >
                <Animated.View style={[
                  styles.nextBtn,
                  {
                    backgroundColor: colors.sideBtn,
                    borderColor: "#7C3AED",
                    transform: [{ scale: nextScale }],
                  },
                ]}>
                  <Text style={[styles.nextIcon, { color: colors.nextIcon }]}>↑</Text>
                </Animated.View>
              </TouchableOpacity>
              <Text style={[styles.sideBtnCount, { color: colors.textMuted }]}>Next</Text>
            </View>
          </View>
        </Animated.View>
      </View>

      <CommentModal
        visible={commentOpen}
        onClose={() => setCommentOpen(false)}
        opinionId={opinion?.id}
        session={session}
        colors={colors}
      />
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
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  card: {
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 6,
    overflow: "hidden",
  },
  cardContent: {
    flex: 1,
    padding: 22,
    flexDirection: "column",
    justifyContent: "space-between",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryEmoji: { fontSize: 13 },
  categoryText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
  liveIndicator: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1,
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
    marginBottom: 16,
  },
  resultInfo: { alignItems: "center", gap: 6, marginTop: 4 },
  totalVotesText: { fontSize: 12, fontWeight: "500" },
  verdictText: { fontSize: 14, fontWeight: "800", textAlign: "center" },
  cardBottom: {},
  voteRow: { flexDirection: "row" },
  voteBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  voteEmoji: { fontSize: 26 },
  voteBtnText: { fontSize: 14 },
  // Sidebar inside card
  sidebar: {
    width: 64,
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
    paddingVertical: 24,
    paddingRight: 10,
  },
  sideItem: { alignItems: "center", gap: 3 },
  avatarBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  sideBtn: {
    width: 42, height: 42, borderRadius: 21,
    borderWidth: 1, alignItems: "center", justifyContent: "center",
  },
  sideBtnIcon: { fontSize: 18 },
  sideBtnCount: { fontSize: 9, fontWeight: "500" },
  nextBtn: {
    width: 42, height: 42, borderRadius: 21,
    borderWidth: 2, alignItems: "center", justifyContent: "center",
  },
  nextIcon: { fontSize: 20, fontWeight: "700" },
});
