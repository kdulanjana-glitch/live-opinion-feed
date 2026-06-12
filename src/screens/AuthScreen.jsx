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
import { getPeoliaColors } from "../constants/peoliaTheme";
import { fs, ms, vs, s } from "../utils/peoliaScale";

// redirectTo must match the scheme in app.json
const RESET_REDIRECT = "liveopinionfeed://auth";

export default function AuthScreen({ initialMode = "login" }) {
  const scheme = useColorScheme();
  const C = getPeoliaColors(scheme);
  const COnAccent = getPeoliaColors("light");
  const st = makeStyles();

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
    st.input,
    {
      backgroundColor: C.surfaceAlt,
      borderColor: focusedField === field ? C.accent : C.borderStrong,
      color: C.textPrimary,
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
      style={[st.screen, { backgroundColor: C.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={st.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={st.logoArea}>
          <View style={[st.logoBadge, { backgroundColor: C.accent }]}>
            <Text style={st.logoEmoji}>🌍</Text>
          </View>
          <Text style={[st.appName, { color: C.textPrimary }]}>
            Live Opinion Feed
          </Text>
          <Text style={[st.tagline, { color: C.textSecondary }]}>
            See what the world really thinks
          </Text>
        </View>

        <View style={[st.card, { backgroundColor: C.surface, borderColor: C.border }]}>

          {/* Login / Sign up tabs */}
          {showTabs && (
            <View style={[st.tabRow, { borderBottomColor: C.border }]}>
              {[{ key: "login", label: "Log in" }, { key: "signup", label: "Sign up" }].map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[st.tab, mode === t.key && { borderBottomColor: C.accent, borderBottomWidth: ms(2) }]}
                  onPress={() => { setMode(t.key); clearMessages(); }}
                >
                  <Text style={[st.tabText, {
                    color: mode === t.key ? C.accent : C.textSecondary,
                    fontWeight: mode === t.key ? "700" : "400",
                  }]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={st.form}>

            {/* Forgot password header */}
            {isForgotMode && (
              <View style={st.sectionHeader}>
                <Text style={[st.sectionTitle, { color: C.textPrimary }]}>Reset password</Text>
                <Text style={[st.sectionSub, { color: C.textSecondary }]}>
                  Enter your email and we'll send a reset link
                </Text>
              </View>
            )}

            {/* Set new password header */}
            {isResetMode && (
              <View style={st.sectionHeader}>
                <Text style={[st.sectionTitle, { color: C.textPrimary }]}>Set new password</Text>
                <Text style={[st.sectionSub, { color: C.textSecondary }]}>
                  Choose a strong password for your account
                </Text>
              </View>
            )}

            {/* Username (signup only) */}
            {mode === "signup" && (
              <View style={st.fieldGroup}>
                <Text style={[st.label, { color: C.textSecondary }]}>Username</Text>
                <TextInput
                  style={inputStyle("username")}
                  placeholder="e.g. kasun123"
                  placeholderTextColor={C.textMuted}
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
              <View style={st.fieldGroup}>
                <Text style={[st.label, { color: C.textSecondary }]}>Email</Text>
                <TextInput
                  style={inputStyle("email")}
                  placeholder="your@email.com"
                  placeholderTextColor={C.textMuted}
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
              <View style={st.fieldGroup}>
                <Text style={[st.label, { color: C.textSecondary }]}>Password</Text>
                <TextInput
                  style={inputStyle("password")}
                  placeholder={mode === "signup" ? "Min. 6 characters" : "Your password"}
                  placeholderTextColor={C.textMuted}
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
                <View style={st.fieldGroup}>
                  <Text style={[st.label, { color: C.textSecondary }]}>New password</Text>
                  <TextInput
                    style={inputStyle("newPassword")}
                    placeholder="Min. 6 characters"
                    placeholderTextColor={C.textMuted}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    onFocus={() => setFocusedField("newPassword")}
                    onBlur={() => setFocusedField(null)}
                    secureTextEntry
                  />
                </View>
                <View style={st.fieldGroup}>
                  <Text style={[st.label, { color: C.textSecondary }]}>Confirm password</Text>
                  <TextInput
                    style={inputStyle("confirmPassword")}
                    placeholder="Repeat your new password"
                    placeholderTextColor={C.textMuted}
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
                style={st.forgotLink}
              >
                <Text style={[st.forgotLinkText, { color: C.accentText }]}>
                  Forgot password?
                </Text>
              </TouchableOpacity>
            )}

            {/* Error / success banners */}
            {error && (
              <View style={[st.messageBanner, { backgroundColor: C.nahBg, borderColor: C.nahText }]}>
                <Text style={[st.messageText, { color: C.nahText }]}>{error}</Text>
              </View>
            )}
            {successMsg && (
              <View style={[st.messageBanner, { backgroundColor: C.yesBg, borderColor: C.yesText }]}>
                <Text style={[st.messageText, { color: C.yesText }]}>{successMsg}</Text>
              </View>
            )}

            {/* Submit button */}
            <TouchableOpacity
              style={[st.submitBtn, { backgroundColor: C.accent, opacity: loading ? 0.7 : 1 }]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={COnAccent.bg} />
                : <Text style={[st.submitText, { color: COnAccent.bg }]}>{submitLabel()}</Text>
              }
            </TouchableOpacity>

            {/* Back to login */}
            {(isForgotMode || isResetMode) && (
              <TouchableOpacity
                onPress={() => { setMode("login"); clearMessages(); }}
                style={st.backLink}
              >
                <Text style={[st.backLinkText, { color: C.accentText }]}>← Back to login</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Text style={[st.terms, { color: C.textMuted }]}>
          By continuing you agree to participate in global opinions.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = () => StyleSheet.create({
  screen: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: ms(24),
    paddingVertical: vs(48),
  },
  logoArea: { alignItems: "center", marginBottom: vs(32) },
  logoBadge: {
    width: s(64),
    height: s(64),
    borderRadius: ms(20),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: vs(14),
  },
  logoEmoji: { fontSize: fs(32) },
  appName: { fontSize: fs(24), fontWeight: "800", letterSpacing: -0.5, marginBottom: vs(6) },
  tagline: { fontSize: fs(14) },
  card: { borderRadius: ms(24), borderWidth: ms(1), overflow: "hidden", marginBottom: vs(20) },
  tabRow: { flexDirection: "row", borderBottomWidth: ms(1) },
  tab: { flex: 1, paddingVertical: vs(16), alignItems: "center" },
  tabText: { fontSize: fs(15) },
  form: { padding: ms(24) },
  sectionHeader: { marginBottom: vs(20) },
  sectionTitle: { fontSize: fs(20), fontWeight: "700", marginBottom: vs(6) },
  sectionSub: { fontSize: fs(14), lineHeight: fs(20) },
  fieldGroup: { marginBottom: vs(16) },
  label: { fontSize: fs(13), fontWeight: "500", marginBottom: vs(6) },
  input: {
    borderWidth: ms(2),
    borderRadius: ms(12),
    paddingHorizontal: ms(14),
    paddingVertical: vs(12),
    fontSize: fs(15),
  },
  forgotLink: { alignSelf: "flex-end", marginBottom: vs(16), marginTop: vs(-8) },
  forgotLinkText: { fontSize: fs(13) },
  messageBanner: { borderWidth: ms(1), borderRadius: ms(10), padding: ms(12), marginBottom: vs(16) },
  messageText: { fontSize: fs(13), lineHeight: fs(18) },
  submitBtn: { borderRadius: ms(14), paddingVertical: vs(16), alignItems: "center", marginTop: vs(4) },
  submitText: { fontSize: fs(16), fontWeight: "700" },
  backLink: { alignItems: "center", marginTop: vs(16) },
  backLinkText: { fontSize: fs(14) },
  terms: { fontSize: fs(11), textAlign: "center", lineHeight: fs(16) },
});
