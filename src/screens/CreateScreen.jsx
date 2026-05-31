import { useState } from "react";
import {
    ActivityIndicator,
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

const palette = {
  dark: {
    bg: "#0A0A0F",
    card: "#13131A",
    cardBorder: "#1E1E2E",
    text: "#F0EFF8",
    textSub: "#6B6A7E",
    textMuted: "#3D3C50",
    input: "#1A1A28",
    inputBorder: "#2A2A3A",
    inputFocus: "#7C3AED",
    primary: "#7C3AED",
    primaryText: "#FFFFFF",
    primaryDisabled: "#3D2B6B",
    error: "#EF4444",
    errorBg: "#1A0505",
    success: "#22C55E",
    successBg: "#052010",
    successBorder: "#0D4020",
    pill: "#1A1A28",
    pillText: "#5A5A7A",
    pillActive: "#2D1B69",
    pillActiveText: "#A78BFA",
    charLimit: "#F59E0B",
  },
  light: {
    bg: "#F5F4FA",
    card: "#FFFFFF",
    cardBorder: "#E8E7F5",
    text: "#0D0C1A",
    textSub: "#7A798E",
    textMuted: "#BCBBCE",
    input: "#F5F4FA",
    inputBorder: "#E8E7F5",
    inputFocus: "#7C3AED",
    primary: "#7C3AED",
    primaryText: "#FFFFFF",
    primaryDisabled: "#C4B5FD",
    error: "#DC2626",
    errorBg: "#FFF5F5",
    success: "#16A34A",
    successBg: "#F0FDF4",
    successBorder: "#BBF7D0",
    pill: "#F0EFF8",
    pillText: "#9A99AE",
    pillActive: "#EDE9FE",
    pillActiveText: "#7C3AED",
    charLimit: "#D97706",
  },
};

const CATEGORIES = [
  { key: "love",          label: "Love",          emoji: "❤️"  },
  { key: "money",         label: "Money",         emoji: "💰"  },
  { key: "life",          label: "Life",          emoji: "🌱"  },
  { key: "tech",          label: "Tech",          emoji: "💻"  },
  { key: "society",       label: "Society",       emoji: "🌍"  },
  { key: "politics",      label: "Politics",      emoji: "🏛️"  },
  { key: "food",          label: "Food",          emoji: "🍕"  },
  { key: "health",        label: "Health",        emoji: "💪"  },
  { key: "sports",        label: "Sports",        emoji: "⚽"  },
  { key: "entertainment", label: "Entertainment", emoji: "🎬"  },
  { key: "science",       label: "Science",       emoji: "🔬"  },
  { key: "education",     label: "Education",     emoji: "📚"  },
  { key: "environment",   label: "Environment",   emoji: "🌿"  },
];

const MAX_CHARS = 140;

const EXAMPLES = [
  "Success requires sacrifice",
  "Remote work is better than office work",
  "True love only happens once in a lifetime",
  "Social media does more harm than good",
  "Money can buy happiness",
];

export default function CreateScreen({ session }) {
  const scheme = useColorScheme();
  const colors = palette[scheme === "dark" ? "dark" : "light"];

  const [text, setText] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [focused, setFocused] = useState(false);
  const [descFocused, setDescFocused] = useState(false);

  const charsLeft = MAX_CHARS - text.length;
  const isOverLimit = charsLeft < 0;
  const isReady = text.trim().length >= 10 && category && !isOverLimit;

  const handleSubmit = async () => {
  if (!isReady) return;
  try {
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();

    const { error: insertError } = await supabase
      .from("opinions")
      .insert({
        text: text.trim(),
        description: description.trim() || null,
        category,
        created_by: user?.id || null,
        status: "approved",
      })
      .select();

    if (insertError) throw insertError;

    setSuccess(true);
    setText("");
    setDescription("");
    setCategory(null);
    setTimeout(() => setSuccess(false), 4000);

  } catch (err) {
    setError(err.message || "Failed to submit. Please try again.");
  } finally {
    setLoading(false);
  }

};

  const handleExample = (example) => {
    setText(example);
    setError(null);
    setSuccess(false);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <StatusBar
        barStyle={scheme === "dark" ? "light-content" : "dark-content"}
        backgroundColor={colors.bg}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Create Opinion
          </Text>
          <Text style={[styles.headerSub, { color: colors.textSub }]}>
            Ask the world what they think
          </Text>
        </View>

        {/* Success banner */}
        {success && (
          <View style={[styles.successBanner, { backgroundColor: colors.successBg, borderColor: colors.successBorder }]}>
            <Text style={[styles.successText, { color: colors.success }]}>
              ✅ Opinion submitted for review. It will appear in the feed once approved.
            </Text>
          </View>
        )}

        {/* Text input card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: focused ? colors.inputFocus : colors.cardBorder }]}>
          <TextInput
            style={[styles.textInput, { color: colors.text }]}
            placeholder="Write a clear, debatable statement..."
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={(t) => {
              setText(t);
              setError(null);
              setSuccess(false);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            multiline
            maxLength={160}
            textAlignVertical="top"
          />

          {/* Character counter */}
          <View style={styles.counterRow}>
            <Text style={[styles.counterHint, { color: colors.textMuted }]}>
              {text.length === 0 ? "Min. 10 characters" : ""}
            </Text>
            <Text style={[
              styles.counter,
              {
                color: isOverLimit
                  ? colors.error
                  : charsLeft <= 20
                  ? colors.charLimit
                  : colors.textMuted,
              },
            ]}>
              {charsLeft}
            </Text>
          </View>
        </View>

        {/* Description input (optional) */}
        <Text style={[styles.sectionLabel, { color: colors.textSub }]}>
          Add context {"("}optional{")"}
        </Text>
        <View style={[styles.descCard, { backgroundColor: colors.card, borderColor: descFocused ? colors.inputFocus : colors.cardBorder }]}>
          <TextInput
            style={[styles.descInput, { color: colors.text }]}
            placeholder="Give voters more background or context…"
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={(t) => { setDescription(t); setError(null); }}
            onFocus={() => setDescFocused(true)}
            onBlur={() => setDescFocused(false)}
            multiline
            maxLength={200}
            textAlignVertical="top"
          />
          <Text style={[styles.descCounter, { color: colors.textMuted }]}>
            {200 - description.length}
          </Text>
        </View>

        {/* Category selector */}
        <Text style={[styles.sectionLabel, { color: colors.textSub }]}>
          Choose a category
        </Text>
        <View style={styles.categoryRow}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[
                styles.categoryPill,
                {
                  backgroundColor:
                    category === cat.key ? colors.pillActive : colors.pill,
                  borderColor:
                    category === cat.key ? colors.inputFocus : "transparent",
                },
              ]}
              onPress={() => {
                setCategory(cat.key);
                setError(null);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
              <Text style={[
                styles.categoryLabel,
                {
                  color: category === cat.key
                    ? colors.pillActiveText
                    : colors.pillText,
                  fontWeight: category === cat.key ? "700" : "400",
                },
              ]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tips */}
        <View style={[styles.tipsCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.tipsTitle, { color: colors.text }]}>
            💡 Tips for a great opinion
          </Text>
          <Text style={[styles.tipItem, { color: colors.textSub }]}>
            • Make it debatable — not obviously true or false
          </Text>
          <Text style={[styles.tipItem, { color: colors.textSub }]}>
            • Keep it short and clear
          </Text>
          <Text style={[styles.tipItem, { color: colors.textSub }]}>
            • Avoid offensive or harmful content
          </Text>
          <Text style={[styles.tipItem, { color: colors.textSub }]}>
            • No names or personal attacks
          </Text>
        </View>

        {/* Examples */}
        <Text style={[styles.sectionLabel, { color: colors.textSub }]}>
          Need inspiration? Tap an example
        </Text>
        <View style={styles.examplesContainer}>
          {EXAMPLES.map((example, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.examplePill, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
              onPress={() => handleExample(example)}
              activeOpacity={0.7}
            >
              <Text style={[styles.exampleText, { color: colors.textSub }]}>
                "{example}"
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Error */}
        {error && (
          <View style={[styles.errorBanner, { backgroundColor: colors.errorBg, borderColor: colors.error }]}>
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        )}

        {/* Submit button */}
        <TouchableOpacity
          style={[
            styles.submitBtn,
            {
              backgroundColor: isReady ? colors.primary : colors.primaryDisabled,
              opacity: loading ? 0.8 : 1,
            },
          ]}
          onPress={handleSubmit}
          disabled={!isReady || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.submitText, { color: colors.primaryText }]}>
              {isReady ? "Submit Opinion" : !text || text.length < 10 ? "Write your opinion first" : !category ? "Choose a category" : "Submit Opinion"}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={[styles.reviewNote, { color: colors.textMuted }]}>
          All opinions are reviewed before appearing in the feed
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + 12 : 56,
  },
  scroll: { paddingHorizontal: 20 },
  header: { marginBottom: 20 },
  headerTitle: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  headerSub: { fontSize: 14, marginTop: 4 },
  successBanner: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  successText: { fontSize: 13, lineHeight: 18 },
  card: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 20,
    minHeight: 120,
  },
  textInput: {
    fontSize: 17,
    lineHeight: 24,
    minHeight: 80,
    fontWeight: "500",
  },
  counterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  counterHint: { fontSize: 11 },
  counter: { fontSize: 12, fontWeight: "600" },
  descCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 20,
    minHeight: 80,
  },
  descInput: {
    fontSize: 14,
    lineHeight: 20,
    minHeight: 56,
  },
  descCounter: { fontSize: 11, textAlign: "right", marginTop: 6 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  categoryEmoji: { fontSize: 14 },
  categoryLabel: { fontSize: 13 },
  tipsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
    gap: 6,
  },
  tipsTitle: { fontSize: 14, fontWeight: "700", marginBottom: 6 },
  tipItem: { fontSize: 13, lineHeight: 20 },
  examplesContainer: { gap: 8, marginBottom: 20 },
  examplePill: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  exampleText: { fontSize: 13, lineHeight: 18, fontStyle: "italic" },
  errorBanner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { fontSize: 13 },
  submitBtn: {
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: "center",
    marginBottom: 10,
  },
  submitText: { fontSize: 16, fontWeight: "700" },
  reviewNote: { fontSize: 11, textAlign: "center" },
});
