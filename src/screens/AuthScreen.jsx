import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
    bg: "#0A0A0F", card: "#13131A", cardBorder: "#1E1E2E",
    text: "#F0EFF8", textSub: "#6B6A7E", textMuted: "#3D3C50",
    input: "#1A1A28", inputBorder: "#2A2A3A", inputFocus: "#7C3AED",
    primary: "#7C3AED", primaryText: "#FFFFFF",
    error: "#EF4444", errorBg: "#1A0505",
    success: "#22C55E", successBg: "#052010",
    divider: "#1E1E2E", link: "#A78BFA",
  },
  light: {
    bg: "#F5F4FA", card: "#FFFFFF", cardBorder: "#E8E7F5",
    text: "#0D0C1A", textSub: "#7A798E", textMuted: "#BCBBCE",
    input: "#F5F4FA", inputBorder: "#E8E7F5", inputFocus: "#7C3AED",
    primary: "#7C3AED", primaryText: "#FFFFFF",
    error: "#DC2626", errorBg: "#FFF5F5",
    success: "#16A34A", successBg: "#F0FDF4",
    divider: "#E8E7F5", link: "#7C3AED",
  },
};

// redirectTo must match the scheme in app.json
const RESET_REDIRECT = "liveopinionfeed://auth";

export default function AuthScreen({ initialMode = "login" }) {
  const scheme = useColorScheme();
  const colors = palette[scheme === "dark" ? "dark" : "light"];

  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [focusedField, setFocusedField] = useState(null);

  const clearMessages = () => { setError(null); setSuccessMsg(null); };

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    try {
      setLoading(true);
      clearMessages();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) throw authError;
      // onAuthStateChange in index.tsx handles navigation after SIGNED_IN fires
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Sign up ────────────────────────────────────────────────────────────────
  const handleSignup = async () => {
    if (!email || !password || !username) {
      setError("Please fill in all fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (username.length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }
    try {
      setLoading(true);
      clearMessages();
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { username: username.trim() } },
      });
      if (authError) throw authError;

      if (data.session) {
        // Email confirmation is disabled — user is logged in immediately
        // onAuthStateChange handles navigation
      } else {
        // Email confirmation is enabled — tell user to check inbox
        setSuccessMsg("Account created! Check your email to confirm, then log in.");
        setMode("login");
        setPassword("");
      }
    } catch (err) {
      setError(err.message || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot password ────────────────────────────────────────────────────────
  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    try {
      setLoading(true);
      clearMessages();
      const { error: authError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: RESET_REDIRECT }
      );
      if (authError) throw authError;
      setSuccessMsg(
        "Password reset email sent! Open the link on this device to set a new password."
      );
    } catch (err) {
      setError(err.message || "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  };

  // ── Set new password (after clicking reset link) ───────────────────────────
  const handleResetPassword = async () => {
    if (!newPassword) {
      setError("Please enter a new password.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    try {
      setLoading(true);
      clearMessages();
      const { error: authError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (authError) throw authError;
      setSuccessMsg("Password updated! You are now logged in.");
      // onAuthStateChange fires SIGNED_IN → index.tsx navigates to feed
    } catch (err) {
      setError(err.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (mode === "login")           handleLogin();
    else if (mode === "signup")     handleSignup();
    else if (mode === "forgot")     handleForgotPassword();
    else if (mode === "reset-password") handleResetPassword();
  };

  const inputStyle = (field) => [
    styles.input,
    {
      backgroundColor: colors.input,
      borderColor: focusedField === field ? colors.inputFocus : colors.inputBorder,
      color: colors.text,
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  const isResetMode = mode === "reset-password";
  const isForgotMode = mode === "forgot";
  const showTabs = !isForgotMode && !isResetMode;

  const submitLabel = () => {
    if (loading) return null;
    if (mode === "login")           return "Log in";
    if (mode === "signup")          return "Create account";
    if (mode === "forgot")          return "Send reset link";
    if (mode === "reset-password")  return "Set new password";
    return "Continue";
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={[styles.logoBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.logoEmoji}>🌍</Text>
          </View>
          <Text style={[styles.appName, { color: colors.text }]}>
            Live Opinion Feed
          </Text>
          <Text style={[styles.tagline, { color: colors.textSub }]}>
            See what the world really thinks
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>

          {/* Login / Sign up tabs */}
          {showTabs && (
            <View style={[styles.tabRow, { borderBottomColor: colors.divider }]}>
              {[{ key: "login", label: "Log in" }, { key: "signup", label: "Sign up" }].map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.tab, mode === t.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                  onPress={() => { setMode(t.key); clearMessages(); }}
                >
                  <Text style={[styles.tabText, {
                    color: mode === t.key ? colors.primary : colors.textSub,
                    fontWeight: mode === t.key ? "700" : "400",
                  }]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.form}>

            {/* Forgot password header */}
            {isForgotMode && (
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Reset password</Text>
                <Text style={[styles.sectionSub, { color: colors.textSub }]}>
                  Enter your email and we'll send a reset link
                </Text>
              </View>
            )}

            {/* Set new password header */}
            {isResetMode && (
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Set new password</Text>
                <Text style={[styles.sectionSub, { color: colors.textSub }]}>
                  Choose a strong password for your account
                </Text>
              </View>
            )}

            {/* Username (signup only) */}
            {mode === "signup" && (
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textSub }]}>Username</Text>
                <TextInput
                  style={inputStyle("username")}
                  placeholder="e.g. kasun123"
                  placeholderTextColor={colors.textMuted}
                  value={username}
                  onChangeText={setUsername}
                  onFocus={() => setFocusedField("username")}
                  onBlur={() => setFocusedField(null)}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            )}

            {/* Email (login / signup / forgot) */}
            {!isResetMode && (
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textSub }]}>Email</Text>
                <TextInput
                  style={inputStyle("email")}
                  placeholder="your@email.com"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                />
              </View>
            )}

            {/* Password (login / signup) */}
            {(mode === "login" || mode === "signup") && (
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textSub }]}>Password</Text>
                <TextInput
                  style={inputStyle("password")}
                  placeholder={mode === "signup" ? "Min. 6 characters" : "Your password"}
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  secureTextEntry
                />
              </View>
            )}

            {/* New password (reset mode) */}
            {isResetMode && (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: colors.textSub }]}>New password</Text>
                  <TextInput
                    style={inputStyle("newPassword")}
                    placeholder="Min. 6 characters"
                    placeholderTextColor={colors.textMuted}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    onFocus={() => setFocusedField("newPassword")}
                    onBlur={() => setFocusedField(null)}
                    secureTextEntry
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: colors.textSub }]}>Confirm password</Text>
                  <TextInput
                    style={inputStyle("confirmPassword")}
                    placeholder="Repeat your new password"
                    placeholderTextColor={colors.textMuted}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    onFocus={() => setFocusedField("confirmPassword")}
                    onBlur={() => setFocusedField(null)}
                    secureTextEntry
                  />
                </View>
              </>
            )}

            {/* Forgot password link */}
            {mode === "login" && (
              <TouchableOpacity
                onPress={() => { setMode("forgot"); clearMessages(); }}
                style={styles.forgotLink}
              >
                <Text style={[styles.forgotLinkText, { color: colors.link }]}>
                  Forgot password?
                </Text>
              </TouchableOpacity>
            )}

            {/* Error / success banners */}
            {error && (
              <View style={[styles.messageBanner, { backgroundColor: colors.errorBg, borderColor: colors.error }]}>
                <Text style={[styles.messageText, { color: colors.error }]}>{error}</Text>
              </View>
            )}
            {successMsg && (
              <View style={[styles.messageBanner, { backgroundColor: colors.successBg, borderColor: colors.success }]}>
                <Text style={[styles.messageText, { color: colors.success }]}>{successMsg}</Text>
              </View>
            )}

            {/* Submit button */}
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={[styles.submitText, { color: colors.primaryText }]}>{submitLabel()}</Text>
              }
            </TouchableOpacity>

            {/* Back to login */}
            {(isForgotMode || isResetMode) && (
              <TouchableOpacity
                onPress={() => { setMode("login"); clearMessages(); }}
                style={styles.backLink}
              >
                <Text style={[styles.backLinkText, { color: colors.link }]}>← Back to login</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Text style={[styles.terms, { color: colors.textMuted }]}>
          By continuing you agree to participate in global opinions.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 48 },
  logoArea: { alignItems: "center", marginBottom: 32 },
  logoBadge: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  logoEmoji: { fontSize: 32 },
  appName: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5, marginBottom: 6 },
  tagline: { fontSize: 14 },
  card: { borderRadius: 24, borderWidth: 1, overflow: "hidden", marginBottom: 20 },
  tabRow: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 16, alignItems: "center" },
  tabText: { fontSize: 15 },
  form: { padding: 24 },
  sectionHeader: { marginBottom: 20 },
  sectionTitle: { fontSize: 20, fontWeight: "700", marginBottom: 6 },
  sectionSub: { fontSize: 14, lineHeight: 20 },
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "500", marginBottom: 6 },
  input: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  forgotLink: { alignSelf: "flex-end", marginBottom: 16, marginTop: -8 },
  forgotLinkText: { fontSize: 13 },
  messageBanner: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
  messageText: { fontSize: 13, lineHeight: 18 },
  submitBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 4 },
  submitText: { fontSize: 16, fontWeight: "700" },
  backLink: { alignItems: "center", marginTop: 16 },
  backLinkText: { fontSize: 14 },
  terms: { fontSize: 11, textAlign: "center", lineHeight: 16 },
});
