import { useEffect, useRef, useState } from "react";
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
    primary: "#7C3AED", amber: "#F59E0B",
    divider: "#1E1E2E",
  },
  light: {
    bg: "#F5F4FA", card: "#FFFFFF", cardBorder: "#E8E7F5",
    text: "#0D0C1A", textSub: "#7A798E", textMuted: "#BCBBCE",
    primary: "#7C3AED", amber: "#D97706",
    divider: "#F0EFF8",
  },
};

export default function SavedScreen({ session, onNavigateToFeed }) {
  const scheme = useColorScheme();
  const colors = palette[scheme === "dark" ? "dark" : "light"];

  const [savedItems, setSavedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; }, [session]);

  useEffect(() => {
    if (session?.user?.id) fetchSaved();
  }, [session]);

  // Realtime: remove unsaved items instantly
  useEffect(() => {
    const channel = supabase.channel("saved-removes")
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "opinion_saves" },
        (payload) => {
          setSavedItems((prev) => prev.filter((s) => s.id !== payload.old.id));
        }
      ).subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const fetchSaved = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("opinion_saves")
        .select("id, created_at, opinion_id, opinions(id, text, category, created_by, users(username))")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setSavedItems(data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleUnsave = async (saveId, opinionId) => {
    setSavedItems((prev) => prev.filter((s) => s.id !== saveId));
    await supabase
      .from("opinion_saves")
      .delete()
      .eq("user_id", session.user.id)
      .eq("opinion_id", opinionId);
  };

  const renderItem = ({ item }) => {
    const opinion = item.opinions;
    if (!opinion) return null;
    const authorName = opinion.users?.username || "anonymous";
    const preview = opinion.text?.length > 90 ? opinion.text.slice(0, 90) + "…" : opinion.text;

    return (
      <TouchableOpacity
        style={[styles.row, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
        onPress={() => onNavigateToFeed?.(opinion.id)}
        activeOpacity={0.85}
      >
        <View style={styles.rowContent}>
          <Text style={[styles.preview, { color: colors.text }]} numberOfLines={2}>{preview}</Text>
          <Text style={[styles.author, { color: colors.textSub }]}>@{authorName}</Text>
        </View>
        <TouchableOpacity
          style={styles.starBtn}
          onPress={() => handleUnsave(item.id, opinion.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.star, { color: colors.amber }]}>⭐</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <StatusBar
        barStyle={scheme === "dark" ? "light-content" : "dark-content"}
        backgroundColor={colors.bg}
      />
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Saved</Text>
        <Text style={[styles.headerSub, { color: colors.textSub }]}>Your bookmarked opinions</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : savedItems.length === 0 ? (
        <View style={styles.centered}>
          <Text style={[styles.emptyIcon]}>⭐</Text>
          <Text style={[styles.emptyText, { color: colors.textSub }]}>
            No saved opinions yet.{"\n"}Tap ⭐ on any opinion to save it.
          </Text>
        </View>
      ) : (
        <FlatList
          data={savedItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) + 12 : 56,
  },
  header: { paddingHorizontal: 20, marginBottom: 16 },
  headerTitle: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  headerSub: { fontSize: 14, marginTop: 4 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, textAlign: "center", lineHeight: 24 },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  rowContent: { flex: 1, gap: 4 },
  preview: { fontSize: 15, fontWeight: "600", lineHeight: 20 },
  author: { fontSize: 12 },
  starBtn: { paddingLeft: 4 },
  star: { fontSize: 20 },
});
