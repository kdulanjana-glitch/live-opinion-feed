import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
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
    agreeDark: "#0A3018",
    disagree: "#EF4444",
    disagreeBg: "#1A0505",
    disagreeBorder: "#3D1010",
    disagreeDark: "#2D0808",
    pill: "#1E1E2E",
    pillText: "#6B6A7E",
    minority: "#F59E0B",
    bar: "#1E1E2E",
    nextBtn: "#1E1E2E",
    nextBtnBorder: "#3A3A5A",
    nextIcon: "#A78BFA",
    sideBtn: "#1E1E2E",
    sideBtnBorder: "#2A2A3A",
    liked: "#EF4444",
    saved: "#F59E0B",
    modalBg: "#13131A",
    modalBorder: "#2A2A3A",
    input: "#1E1E2E",
    inputBorder: "#3A3A5A",
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
    agreeDark: "#DCFCE7",
    disagree: "#DC2626",
    disagreeBg: "#FFF5F5",
    disagreeBorder: "#FECACA",
    disagreeDark: "#FFE4E4",
    pill: "#F0EFF8",
    pillText: "#9A99AE",
    minority: "#D97706",
    bar: "#F0EFF8",
    nextBtn: "#FFFFFF",
    nextBtnBorder: "#E0DEFA",
    nextIcon: "#7C3AED",
    sideBtn: "#FFFFFF",
    sideBtnBorder: "#E0DEFA",
    liked: "#EF4444",
    saved: "#D97706",
    modalBg: "#FFFFFF",
    modalBorder: "#E0DEFA",
    input: "#F5F4FA",
    inputBorder: "#E0DEFA",
  },
};

const CATEGORY_LABELS = {
  love: "Love", money: "Money", life: "Life", tech: "Tech", society: "Society",
};

// ── Comment Modal ─────────────────────────────────────────────
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
      <View style={commentStyles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ width: "100%", maxWidth: 480 }}
        >
          <View style={[commentStyles.sheet, { backgroundColor: colors.modalBg, borderColor: colors.modalBorder }]}>
            <View style={[commentStyles.handle, { backgroundColor: colors.sideBtnBorder }]} />
            <View style={commentStyles.sheetHeader}>
              <Text style={[commentStyles.sheetTitle, { color: colors.text }]}>Comments</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={[commentStyles.closeBtn, { color: colors.textSub }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <ActivityIndicator color="#7C3AED" style={{ marginVertical: 20 }} />
            ) : comments.length === 0 ? (
              <Text style={[commentStyles.empty, { color: colors.textMuted }]}>
                No comments yet. Be the first!
              </Text>
            ) : (
              <ScrollView style={commentStyles.commentList} showsVerticalScrollIndicator={false}>
                {comments.map((c) => (
                  <View key={c.id} style={commentStyles.commentRow}>
                    <View style={[commentStyles.commentAvatar, { backgroundColor: "#7C3AED" }]}>
                      <Text style={commentStyles.commentAvatarText}>
                        {(c.users?.username || "?")[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={commentStyles.commentBody}>
                      <Text style={[commentStyles.commentUser, { color: colors.textSub }]}>
                        @{c.users?.username || "anonymous"}
                      </Text>
                      <Text style={[commentStyles.commentText, { color: colors.text }]}>{c.text}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={[commentStyles.inputRow, { borderTopColor: colors.modalBorder }]}>
              <TextInput
                style={[commentStyles.input, { backgroundColor: colors.input, borderColor: colors.inputBorder, color: colors.text }]}
                placeholder="Add a comment..."
                placeholderTextColor={colors.textMuted}
                value={newComment}
                onChangeText={setNewComment}
                maxLength={300}
              />
              <TouchableOpacity
                style={[commentStyles.sendBtn, { backgroundColor: newComment.trim() ? "#7C3AED" : colors.sideBtn }]}
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

const commentStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end", alignItems: "center" },
  sheet: { width: "100%", borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 20, maxHeight: SH * 0.7 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 16, fontWeight: "700" },
  closeBtn: { fontSize: 18, padding: 4 },
  empty: { textAlign: "center", fontSize: 13, paddingVertical: 24 },
  commentList: { maxHeight: SH * 0.35 },
  commentRow: { flexDirection: "row", gap: 10, marginBottom: 14, alignItems: "flex-start" },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  commentAvatarText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  commentBody: { flex: 1 },
  commentUser: { fontSize: 11, marginBottom: 2 },
  commentText: { fontSize: 13, lineHeight: 18 },
  inputRow: { flexDirection: "row", gap: 8, borderTopWidth: 1, paddingTop: 12, marginTop: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});

// ── Main Feed Screen ──────────────────────────────────────────
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

  // Double tap state
  const agreeTapRef = useRef(null);
  const disagreeTapRef = useRef(null);

  // Animations
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const cardTranslateY = useRef(new Animated.Value(0)).current;
  const nextScale = useRef(new Animated.Value(1)).current;
  const likeScale = useRef(new Animated.Value(1)).current;
  const saveScale = useRef(new Animated.Value(1)).current;

  useEffect(() => { fetchOpinions(); }, []);

  useEffect(() => {
    if (opinions.length > 0 && session?.user?.id) {
      checkUserActions();
    }
  }, [currentIndex, opinions]);

  useEffect(() => {
    const channel = supabase
      .channel("opinions-realtime")
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "opinions" },
        (payload) => {
          setOpinions((prev) =>
            prev.map((op) => op.id === payload.new.id ? { ...op, ...payload.new } : op)
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

  const checkUserActions = async () => {
    if (!session?.user?.id || !opinions[currentIndex]) return;
    const opId = opinions[currentIndex].id;

    // Check existing vote
    const { data: voteData } = await supabase
      .from("votes")
      .select("vote_value")
      .eq("user_id", session.user.id)
      .eq("opinion_id", opId)
      .eq("voted_date", new Date().toISOString().split("T")[0])
      .single();
    setUserVote(voteData?.vote_value || null);

    // Check like
    const { data: likeData } = await supabase
      .from("opinion_likes")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("opinion_id", opId)
      .single();
    setLiked(!!likeData);

    // Check save
    const { data: saveData } = await supabase
      .from("opinion_saves")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("opinion_id", opId)
      .single();
    setSaved(!!saveData);
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

  // Double tap handler
  const handleDoubleTap = (tapRef, voteValue) => {
    if (userVote) return;
    const now = Date.now();
    if (tapRef.current && now - tapRef.current < 350) {
      // Double tap confirmed
      tapRef.current = null;
      handleVote(voteValue);
    } else {
      tapRef.current = now;
    }
  };

  const handleVote = async (value) => {
    if (userVote) return;
    const opinion = opinions[currentIndex];
    if (!opinion) return;

    setUserVote(value);

    // Update local count optimistically
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
      Animated.spring(likeScale, { toValue: 1.3, useNativeDriver: true }),
      Animated.spring(likeScale, { toValue: 1, useNativeDriver: true }),
    ]).start();

    if (liked) {
      setLiked(false);
      await supabase.from("opinion_likes")
        .delete()
        .eq("user_id", session.user.id)
        .eq("opinion_id", opinion.id);
    } else {
      setLiked(true);
      await supabase.from("opinion_likes").insert({
        user_id: session.user.id,
        opinion_id: opinion.id,
      });
    }
  };

  const handleSave = async () => {
    if (!session?.user?.id) return;
    const opinion = opinions[currentIndex];
    Animated.sequence([
      Animated.spring(saveScale, { toValue: 1.3, useNativeDriver: true }),
      Animated.spring(saveScale, { toValue: 1, useNativeDriver: true }),
    ]).start();

    if (saved) {
      setSaved(false);
      await supabase.from("opinion_saves")
        .delete()
        .eq("user_id", session.user.id)
        .eq("opinion_id", opinion.id);
    } else {
      setSaved(true);
      await supabase.from("opinion_saves").insert({
        user_id: session.user.id,
        opinion_id: opinion.id,
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
        <Text style={{ color: colors.textSub, fontSize: 15 }}>No opinions yet.</Text>
      </View>
    );
  }

  const opinion = opinions[currentIndex];
  const total = opinion?.total_votes || 0;
  const agreePercent = total > 0 ? Math.round((opinion.agree_count / total) * 100) : 50;
  const disagreePercent = 100 - agreePercent;
  const isMinority =
    (userVote === "agree" && agreePercent < 50) ||
    (userVote === "disagree" && disagreePercent < 50);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={scheme === "dark" ? "light-content" : "dark-content"} backgroundColor={colors.bg} />

      <View style={styles.layout}>
        {/* 9:16 Card */}
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
          {/* Top */}
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

            {/* After vote — show total votes + minority/majority */}
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
            {!userVote && (
              <Text style={[styles.doubleTapHint, { color: colors.textMuted }]}>
                double tap to vote
              </Text>
            )}
            <View style={styles.voteRow}>
              {/* Agree button */}
              <TouchableOpacity
                style={[
                  styles.voteBtn,
                  {
                    backgroundColor: userVote === "agree"
                      ? colors.agreeDark
                      : colors.agreeBg,
                    borderColor: colors.agreeBorder,
                    borderWidth: userVote === "agree" ? 2 : 1.5,
                  },
                ]}
                onPress={() => handleDoubleTap(agreeTapRef, "agree")}
                activeOpacity={0.85}
                disabled={!!userVote && userVote !== "agree"}
              >
                <Text style={styles.voteEmoji}>👍</Text>
                <Text style={[styles.voteBtnText, { color: colors.agree, fontWeight: userVote === "agree" ? "800" : "700" }]}>
                  {userVote ? `${agreePercent}%` : "Agree"}
                </Text>
              </TouchableOpacity>

              <View style={{ width: 10 }} />

              {/* Disagree button */}
              <TouchableOpacity
                style={[
                  styles.voteBtn,
                  {
                    backgroundColor: userVote === "disagree"
                      ? colors.disagreeDark
                      : colors.disagreeBg,
                    borderColor: colors.disagreeBorder,
                    borderWidth: userVote === "disagree" ? 2 : 1.5,
                  },
                ]}
                onPress={() => handleDoubleTap(disagreeTapRef, "disagree")}
                activeOpacity={0.85}
                disabled={!!userVote && userVote !== "disagree"}
              >
                <Text style={styles.voteEmoji}>👎</Text>
                <Text style={[styles.voteBtnText, { color: colors.disagree, fontWeight: userVote === "disagree" ? "800" : "700" }]}>
                  {userVote ? `${disagreePercent}%` : "Disagree"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* Right sidebar — TikTok style */}
        <View style={styles.sidebar}>
          {/* User avatar */}
          <View style={styles.sideItem}>
            <View style={[styles.avatarBtn, { backgroundColor: "#7C3AED" }]}>
              <Text style={styles.avatarText}>
                {(session?.user?.email?.[0] || "?").toUpperCase()}
              </Text>
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
                const url = window?.location?.href || "https://live-opinion-feed.vercel.app";
                if (navigator?.share) {
                  navigator.share({ title: opinion?.text, url });
                } else if (navigator?.clipboard) {
                  navigator.clipboard.writeText(url);
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.sideBtnIcon}>↗️</Text>
            </TouchableOpacity>
            <Text style={[styles.sideBtnCount, { color: colors.textMuted }]}>Share</Text>
          </View>

          {/* Next */}
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
                  backgroundColor: colors.nextBtn,
                  borderColor: colors.nextBtnBorder,
                  transform: [{ scale: nextScale }],
                },
              ]}>
                <Text style={[styles.nextIcon, { color: colors.nextIcon }]}>↑</Text>
              </Animated.View>
            </TouchableOpacity>
            <Text style={[styles.sideBtnCount, { color: colors.textMuted }]}>Next</Text>
          </View>
        </View>
      </View>

      {/* Comment Modal */}
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
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 6,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  categoryPill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  categoryText: { fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
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
  resultInfo: { alignItems: "center", gap: 6 },
  totalVotesText: { fontSize: 12, fontWeight: "500" },
  verdictText: { fontSize: 14, fontWeight: "800", textAlign: "center" },
  cardBottom: { gap: 8 },
  doubleTapHint: { fontSize: 11, textAlign: "center" },
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
  voteBtnText: { fontSize: 13 },
  // Sidebar
  sidebar: {
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingBottom: 8,
  },
  sideItem: { alignItems: "center", gap: 4 },
  avatarBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  sideBtn: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1, alignItems: "center", justifyContent: "center",
  },
  sideBtnIcon: { fontSize: 20 },
  sideBtnCount: { fontSize: 10, fontWeight: "500" },
  nextBtn: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1.5, alignItems: "center", justifyContent: "center",
  },
  nextIcon: { fontSize: 20, fontWeight: "700" },
});
