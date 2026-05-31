import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
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

const palette = {
  dark: {
    bg: "#0A0A0F", card: "#13131A", cardBorder: "#2A2A3A",
    text: "#F0EFF8", textSub: "#6B6A7E", textMuted: "#3D3C50",
    agree: "#22C55E", agreeBg: "#0A1A0F", agreeBorder: "#0D4020", agreeDark: "#052010",
    disagree: "#EF4444", disagreeBg: "#1A0A0A", disagreeBorder: "#3D1010", disagreeDark: "#1A0505",
    pill: "#2A2A3A", pillText: "#A0A0B8", pillBorder: "#3A3A5A",
    minority: "#F59E0B",
    sideBtn: "#1E1E2E", sideBtnBorder: "#2A2A3A",
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
    minority: "#D97706",
    sideBtn: "#F5F4FA", sideBtnBorder: "#E0DEFA",
    liked: "#EF4444", saved: "#D97706",
    modalBg: "#FFFFFF", modalBorder: "#E0DEFA",
    input: "#F5F4FA", inputBorder: "#E0DEFA",
    liveGreen: "#16A34A", liveBg: "#F0FDF4", liveBorder: "#BBF7D0",
    categoryBg: "#EDE9FE", categoryText: "#5B21B6", categoryBorder: "#C4B5FD",
  },
};

const CATEGORY_LABELS = {
  love:          { label: "Love",          emoji: "❤️"  },
  money:         { label: "Money",         emoji: "💰"  },
  life:          { label: "Life",          emoji: "🌱"  },
  tech:          { label: "Tech",          emoji: "💻"  },
  society:       { label: "Society",       emoji: "🌍"  },
  politics:      { label: "Politics",      emoji: "🏛️"  },
  food:          { label: "Food",          emoji: "🍕"  },
  health:        { label: "Health",        emoji: "💪"  },
  sports:        { label: "Sports",        emoji: "⚽"  },
  entertainment: { label: "Entertainment", emoji: "🎬"  },
  science:       { label: "Science",       emoji: "🔬"  },
  education:     { label: "Education",     emoji: "📚"  },
  environment:   { label: "Environment",   emoji: "🌿"  },
};

function CommentModal({ visible, onClose, opinionId, session, colors, onCommentPosted }) {
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
    onCommentPosted?.(opinionId);
    setSubmitting(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={cs.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ width: "100%" }}>
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

export default function FeedScreen({ session, onRequireAuth, onNavigateToUser, scrollToId, onScrolled }) {
  const scheme = useColorScheme();
  const colors = palette[scheme === "dark" ? "dark" : "light"];

  const [displayOpinions, setDisplayOpinions] = useState([]);
  const [baseOpinions, setBaseOpinions] = useState([]);
  const [cardStates, setCardStates] = useState({});
  const [visibleIndex, setVisibleIndex] = useState(0);
  const [commentOpen, setCommentOpen] = useState(false);
  const [listHeight, setListHeight] = useState(0);
  const [loading, setLoading] = useState(true);

  const flatListRef = useRef(null);
  const tapTimers = useRef({});
  const likeScales = useRef({});
  const saveScales = useRef({});
  const displayOpinionsRef = useRef([]);
  const sessionRef = useRef(session);
  const listHeightRef = useRef(0);
  const fetchingMoreRef = useRef(false);
  // Stores the target opinion ID while waiting for list + height to be ready
  const pendingScrollRef = useRef(scrollToId || null);

  useEffect(() => { displayOpinionsRef.current = displayOpinions; }, [displayOpinions]);
  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { listHeightRef.current = listHeight; }, [listHeight]);

  const getLikeScale = (id) => {
    if (!likeScales.current[id]) likeScales.current[id] = new Animated.Value(1);
    return likeScales.current[id];
  };
  const getSaveScale = (id) => {
    if (!saveScales.current[id]) saveScales.current[id] = new Animated.Value(1);
    return saveScales.current[id];
  };

  useEffect(() => { fetchOpinions(); }, []);

  // Realtime: prepend new approved opinions
  useEffect(() => {
    const channel = supabase.channel("feed-inserts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "opinions" },
        (payload) => {
          if (payload.new.status === "approved") {
            setDisplayOpinions((prev) => [payload.new, ...prev]);
            setBaseOpinions((prev) => [payload.new, ...prev]);
          }
        }
      ).subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  // Realtime: update counts
  useEffect(() => {
    const channel = supabase.channel("feed-updates")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "opinions" },
        (payload) => {
          setDisplayOpinions((prev) =>
            prev.map((op) => op.id === payload.new.id ? { ...op, ...payload.new } : op)
          );
          setBaseOpinions((prev) =>
            prev.map((op) => op.id === payload.new.id ? { ...op, ...payload.new } : op)
          );
        }
      ).subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  // Move a specific opinion to index 0, scroll FlatList to top.
  // Offset 0 is always correct regardless of listHeight measurement timing.
  const navigateToOpinion = async (targetId) => {
    if (!targetId) return;
    let targetOp = displayOpinionsRef.current.find((op) => op.id === targetId);
    if (!targetOp) {
      const { data } = await supabase
        .from("opinions")
        .select("*, users(username)")
        .eq("id", targetId)
        .maybeSingle();
      if (!data) { pendingScrollRef.current = null; return; }
      targetOp = data;
    }
    // Put target at the front of the list
    setDisplayOpinions((prev) => [targetOp, ...prev.filter((op) => op.id !== targetOp.id)]);
    // Scroll to offset 0 — target is now always at index 0
    setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
      pendingScrollRef.current = null;
      onScrolled?.();
    }, 200);
  };

  // When scrollToId prop changes (e.g. coming back from UserProfileScreen while feed is alive)
  useEffect(() => {
    if (!scrollToId) return;
    pendingScrollRef.current = scrollToId;
    // Only navigate immediately if the feed list is already loaded
    if (displayOpinionsRef.current.length > 0) {
      navigateToOpinion(scrollToId);
    }
    // If not loaded yet, fetchOpinions handles it
  }, [scrollToId]);

  const fetchOpinions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("opinions")
        .select("*, users(username)")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      let opinions = [...data].sort(() => Math.random() - 0.5);

      // If there's a pending scroll target, put it at index 0 before rendering.
      // The FlatList starts at offset 0 by default, so the target is immediately visible —
      // no scrollToOffset call needed at all.
      const targetId = pendingScrollRef.current;
      if (targetId) {
        const idx = opinions.findIndex((op) => op.id === targetId);
        if (idx > 0) {
          // Found but not at front — move it there
          const [t] = opinions.splice(idx, 1);
          opinions.unshift(t);
        } else if (idx < 0) {
          // Not in the 30 loaded — fetch it specifically and prepend
          const { data: t } = await supabase
            .from("opinions")
            .select("*, users(username)")
            .eq("id", targetId)
            .maybeSingle();
          if (t) opinions.unshift(t);
        }
        // idx === 0: already at front, nothing to do
        setTimeout(() => { pendingScrollRef.current = null; onScrolled?.(); }, 400);
      }

      setBaseOpinions(opinions);
      setDisplayOpinions(opinions);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleEndReached = useCallback(() => {
    if (fetchingMoreRef.current) return;
    fetchingMoreRef.current = true;
    const base = displayOpinionsRef.current.slice(0, baseOpinions.length || 30);
    const more = [...base].sort(() => Math.random() - 0.5);
    setDisplayOpinions((prev) => [...prev, ...more]);
    fetchingMoreRef.current = false;
  }, []);

  const fetchCardState = async (opinionId) => {
    const uid = sessionRef.current?.user?.id;
    if (!uid) return;
    const today = new Date().toISOString().split("T")[0];
    const [voteRes, likeRes, saveRes] = await Promise.all([
      supabase.from("votes").select("vote_value").eq("user_id", uid).eq("opinion_id", opinionId).eq("voted_date", today).maybeSingle(),
      supabase.from("opinion_likes").select("id").eq("user_id", uid).eq("opinion_id", opinionId).maybeSingle(),
      supabase.from("opinion_saves").select("id").eq("user_id", uid).eq("opinion_id", opinionId).maybeSingle(),
    ]);
    setCardStates((prev) => ({
      ...prev,
      [opinionId]: {
        userVote: voteRes.data?.vote_value || null,
        liked: !!likeRes.data,
        saved: !!saveRes.data,
      },
    }));
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length === 0) return;
    const idx = viewableItems[0].index ?? 0;
    setVisibleIndex(idx);
    const op = displayOpinionsRef.current[idx];
    if (op) fetchCardState(op.id);
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const handleVote = useCallback(async (opinion, value) => {
    if (!sessionRef.current?.user?.id) { onRequireAuth?.(); return; }
    setCardStates((prev) => {
      if (prev[opinion.id]?.userVote) return prev;
      return { ...prev, [opinion.id]: { ...prev[opinion.id], userVote: value } };
    });
    setDisplayOpinions((prev) => prev.map((op) =>
      op.id === opinion.id ? {
        ...op,
        agree_count: value === "agree" ? (op.agree_count || 0) + 1 : op.agree_count,
        disagree_count: value === "disagree" ? (op.disagree_count || 0) + 1 : op.disagree_count,
        total_votes: (op.total_votes || 0) + 1,
      } : op
    ));
    await supabase.from("votes").insert({
      user_id: sessionRef.current.user.id,
      opinion_id: opinion.id,
      vote_value: value,
      voted_date: new Date().toISOString().split("T")[0],
    });
  }, [onRequireAuth]);

  const handleDoubleTapVote = useCallback((opinion, value) => {
    const state = cardStates[opinion.id] || {};
    if (state.userVote) return;
    const key = `${opinion.id}-${value}`;
    const now = Date.now();
    const last = tapTimers.current[key] || 0;
    if (now - last < 350) {
      tapTimers.current[key] = 0;
      handleVote(opinion, value);
    } else {
      tapTimers.current[key] = now;
    }
  }, [cardStates, handleVote]);

  const handleLike = useCallback(async (opinion) => {
    if (!sessionRef.current?.user?.id) { onRequireAuth?.(); return; }
    const uid = sessionRef.current.user.id;
    const isCurrentlyLiked = cardStates[opinion.id]?.liked;
    const delta = isCurrentlyLiked ? -1 : 1;

    const anim = getLikeScale(opinion.id);
    Animated.sequence([
      Animated.spring(anim, { toValue: 1.4, useNativeDriver: true }),
      Animated.spring(anim, { toValue: 1, useNativeDriver: true }),
    ]).start();

    // Optimistically toggle icon
    setCardStates((prev) => ({
      ...prev,
      [opinion.id]: { ...prev[opinion.id], liked: !isCurrentlyLiked },
    }));
    // Optimistically update displayed count
    setDisplayOpinions((prev) => prev.map((op) =>
      op.id === opinion.id
        ? { ...op, like_count: Math.max(0, (op.like_count || 0) + delta) }
        : op
    ));

    if (isCurrentlyLiked) {
      await supabase.from("opinion_likes").delete().eq("user_id", uid).eq("opinion_id", opinion.id);
    } else {
      await supabase.from("opinion_likes").insert({ user_id: uid, opinion_id: opinion.id });
    }
  }, [cardStates, onRequireAuth]);

  const handleSave = useCallback(async (opinion) => {
    if (!sessionRef.current?.user?.id) { onRequireAuth?.(); return; }
    const uid = sessionRef.current.user.id;
    const isCurrentlySaved = cardStates[opinion.id]?.saved;
    const delta = isCurrentlySaved ? -1 : 1;

    const anim = getSaveScale(opinion.id);
    Animated.sequence([
      Animated.spring(anim, { toValue: 1.4, useNativeDriver: true }),
      Animated.spring(anim, { toValue: 1, useNativeDriver: true }),
    ]).start();

    // Optimistically toggle icon
    setCardStates((prev) => ({
      ...prev,
      [opinion.id]: { ...prev[opinion.id], saved: !isCurrentlySaved },
    }));
    // Optimistically update displayed count
    setDisplayOpinions((prev) => prev.map((op) =>
      op.id === opinion.id
        ? { ...op, save_count: Math.max(0, (op.save_count || 0) + delta) }
        : op
    ));

    if (isCurrentlySaved) {
      await supabase.from("opinion_saves").delete().eq("user_id", uid).eq("opinion_id", opinion.id);
    } else {
      await supabase.from("opinion_saves").insert({ user_id: uid, opinion_id: opinion.id });
    }
  }, [cardStates, onRequireAuth]);

  const handleAvatarPress = useCallback((opinion) => {
    if (!sessionRef.current?.user?.id) { onRequireAuth?.(); return; }
    if (opinion.created_by) onNavigateToUser?.(opinion.created_by);
  }, [onRequireAuth, onNavigateToUser]);

  const handleComment = useCallback(() => {
    if (!sessionRef.current?.user?.id) { onRequireAuth?.(); return; }
    setCommentOpen(true);
  }, [onRequireAuth]);

  const handleShare = useCallback((opinion) => {
    if (!sessionRef.current?.user?.id) { onRequireAuth?.(); return; }
    // Native share would use Share.share() — keeping as stub for now
  }, [onRequireAuth]);

  const renderCard = useCallback(({ item, index }) => {
    const state = cardStates[item.id] || {};
    const total = item.total_votes || 0;
    const agreePercent = total > 0 ? Math.round((item.agree_count / total) * 100) : 50;
    const disagreePercent = 100 - agreePercent;
    const isMinority =
      (state.userVote === "agree" && agreePercent < 50) ||
      (state.userVote === "disagree" && disagreePercent < 50);
    const catInfo = CATEGORY_LABELS[item.category];
    const creatorInitial = (item.users?.username || item.created_by || "?")[0].toUpperCase();
    const likeScale = getLikeScale(item.id);
    const saveScale = getSaveScale(item.id);

    const itemHeight = listHeight > 0 ? listHeight : SH;
    return (
      <View style={{ height: itemHeight, backgroundColor: colors.bg }}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Card main content */}
          <View style={styles.cardContent}>
            {/* Top row */}
            <View style={styles.cardTop}>
              <View style={[styles.categoryPill, { backgroundColor: colors.categoryBg, borderColor: colors.categoryBorder }]}>
                {catInfo && <Text style={styles.categoryEmoji}>{catInfo.emoji}</Text>}
                <Text style={[styles.categoryText, { color: colors.categoryText }]}>
                  {catInfo?.label ?? item.category}
                </Text>
              </View>
              <View style={styles.topRight}>
                <View style={[styles.liveIndicator, { backgroundColor: colors.liveBg, borderColor: colors.liveBorder }]}>
                  <View style={[styles.liveDot, { backgroundColor: colors.liveGreen }]} />
                  <Text style={[styles.liveText, { color: colors.liveGreen }]}>LIVE</Text>
                </View>
                <Text style={[styles.counter, { color: colors.textMuted }]}>
                  {index + 1}
                </Text>
              </View>
            </View>

            {/* Center — opinion text */}
            <View style={styles.centerArea}>
              <Text style={[styles.opinionText, { color: colors.text }]}>{item.text}</Text>
              {!!item.description && (
                <Text style={[styles.descriptionText, { color: colors.textSub }]}>
                  {item.description}
                </Text>
              )}
              {state.userVote && (
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
            <View style={styles.voteRow}>
              <TouchableOpacity
                style={[styles.voteBtn, {
                  backgroundColor: state.userVote === "agree" ? colors.agreeDark : colors.agreeBg,
                  borderColor: colors.agreeBorder,
                  borderWidth: state.userVote === "agree" ? 2.5 : 1.5,
                }]}
                onPress={() => handleDoubleTapVote(item, "agree")}
                activeOpacity={0.85}
              >
                <Text style={styles.voteEmoji}>👍</Text>
                <Text style={[styles.voteBtnText, { color: colors.agree, fontWeight: state.userVote === "agree" ? "900" : "600" }]}>
                  {state.userVote ? `${agreePercent}%` : "Agree"}
                </Text>
              </TouchableOpacity>

              <View style={{ width: 10 }} />

              <TouchableOpacity
                style={[styles.voteBtn, {
                  backgroundColor: state.userVote === "disagree" ? colors.disagreeDark : colors.disagreeBg,
                  borderColor: colors.disagreeBorder,
                  borderWidth: state.userVote === "disagree" ? 2.5 : 1.5,
                }]}
                onPress={() => handleDoubleTapVote(item, "disagree")}
                activeOpacity={0.85}
              >
                <Text style={styles.voteEmoji}>👎</Text>
                <Text style={[styles.voteBtnText, { color: colors.disagree, fontWeight: state.userVote === "disagree" ? "900" : "600" }]}>
                  {state.userVote ? `${disagreePercent}%` : "Disagree"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Right sidebar */}
          <View style={styles.sidebar}>
            {/* Creator avatar */}
            <View style={styles.sideItem}>
              <TouchableOpacity
                style={[styles.avatarBtn, { backgroundColor: "#7C3AED" }]}
                onPress={() => handleAvatarPress(item)}
                activeOpacity={0.8}
              >
                <Text style={styles.avatarText}>{creatorInitial}</Text>
              </TouchableOpacity>
            </View>

            {/* Like */}
            <View style={styles.sideItem}>
              <TouchableOpacity
                style={[styles.sideBtn, { backgroundColor: colors.sideBtn, borderColor: colors.sideBtnBorder }]}
                onPress={() => handleLike(item)}
                activeOpacity={0.8}
              >
                <Animated.Text style={[styles.sideBtnIcon, { transform: [{ scale: likeScale }] }]}>
                  {state.liked ? "❤️" : "🤍"}
                </Animated.Text>
              </TouchableOpacity>
              <Text style={[styles.sideBtnCount, { color: colors.textMuted }]}>
                {(item.like_count || 0).toLocaleString()}
              </Text>
            </View>

            {/* Comment */}
            <View style={styles.sideItem}>
              <TouchableOpacity
                style={[styles.sideBtn, { backgroundColor: colors.sideBtn, borderColor: colors.sideBtnBorder }]}
                onPress={() => handleComment(item)}
                activeOpacity={0.8}
              >
                <Text style={styles.sideBtnIcon}>💬</Text>
              </TouchableOpacity>
              <Text style={[styles.sideBtnCount, { color: colors.textMuted }]}>
                {(item.comment_count || 0).toLocaleString()}
              </Text>
            </View>

            {/* Save */}
            <View style={styles.sideItem}>
              <TouchableOpacity
                style={[styles.sideBtn, { backgroundColor: colors.sideBtn, borderColor: colors.sideBtnBorder }]}
                onPress={() => handleSave(item)}
                activeOpacity={0.8}
              >
                <Animated.Text style={[styles.sideBtnIcon, { transform: [{ scale: saveScale }] }]}>
                  {state.saved ? "🔖" : "🏷️"}
                </Animated.Text>
              </TouchableOpacity>
              <Text style={[styles.sideBtnCount, { color: colors.textMuted }]}>
                {(item.save_count || 0).toLocaleString()}
              </Text>
            </View>

            {/* Share */}
            <View style={styles.sideItem}>
              <TouchableOpacity
                style={[styles.sideBtn, { backgroundColor: colors.sideBtn, borderColor: colors.sideBtnBorder }]}
                onPress={() => handleShare(item)}
                activeOpacity={0.8}
              >
                <Text style={styles.sideBtnIcon}>↗️</Text>
              </TouchableOpacity>
              <Text style={[styles.sideBtnCount, { color: colors.textMuted }]}>Share</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }, [cardStates, colors, listHeight, handleDoubleTapVote, handleLike, handleSave, handleAvatarPress, handleComment, handleShare]);

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={{ color: colors.textSub, fontSize: 14, marginTop: 16 }}>Loading opinions...</Text>
      </View>
    );
  }

  if (displayOpinions.length === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: colors.textSub, fontSize: 15 }}>No opinions yet.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={scheme === "dark" ? "light-content" : "dark-content"} backgroundColor={colors.bg} />
      <FlatList
        ref={flatListRef}
        data={displayOpinions}
        renderItem={renderCard}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        extraData={cardStates}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onEndReached={handleEndReached}
        onEndReachedThreshold={3}
        removeClippedSubviews
        windowSize={5}
        maxToRenderPerBatch={3}
        initialNumToRender={2}
        style={styles.flatList}
        onLayout={(e) => setListHeight(e.nativeEvent.layout.height)}
      />
      <CommentModal
        visible={commentOpen}
        onClose={() => setCommentOpen(false)}
        opinionId={displayOpinions[visibleIndex]?.id}
        session={session}
        colors={colors}
        onCommentPosted={(opinionId) => {
          setDisplayOpinions((prev) => prev.map((op) =>
            op.id === opinionId
              ? { ...op, comment_count: (op.comment_count || 0) + 1 }
              : op
          ));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0,
  },
  flatList: {
    flex: 1,
  },
  card: {
    flex: 1,
    flexDirection: "row",
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: 28,
    borderWidth: 1,
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
  descriptionText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    fontStyle: "italic",
    marginTop: 2,
    marginBottom: 10,
    paddingHorizontal: 8,
  },
  resultInfo: { alignItems: "center", gap: 6, marginTop: 4 },
  totalVotesText: { fontSize: 12, fontWeight: "500" },
  verdictText: { fontSize: 14, fontWeight: "800", textAlign: "center" },
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
  sidebar: {
    width: 68,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    paddingVertical: 24,
    paddingRight: 10,
  },
  sideItem: { alignItems: "center", gap: 3 },
  avatarBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  sideBtn: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1, alignItems: "center", justifyContent: "center",
  },
  sideBtnIcon: { fontSize: 18 },
  sideBtnCount: { fontSize: 9, fontWeight: "500" },
});
