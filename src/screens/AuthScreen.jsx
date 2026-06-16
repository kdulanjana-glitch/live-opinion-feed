// ─────────────────────────────────────────────
// Peolia — AuthScreen
// src/screens/AuthScreen.jsx
//
// Single screen with Sign Up ⇄ Log In toggle.
// Auth methods: Email+Password, Google OAuth, Guest.
// Email verification is ON in Supabase.
// After sign up → verification notice + switch to Log In tab.
// After log in → calls onAuth(session).
// Guest → calls onGuest() to enter app with limited access.
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, useColorScheme,
  Alert, ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { getPeoliaColors } from '../constants/peoliaTheme';
import { fs, ms, vs, s } from '../utils/peoliaScale';

export default function AuthScreen({ onAuth, onGuest }) {
  const scheme = useColorScheme();
  const C = getPeoliaColors(scheme);
  const styles = makeStyles(C);

  const [tab,             setTab]             = useState('login');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading,         setLoading]         = useState(false);
  const [verifyNotice,    setVerifyNotice]    = useState(false);

  const resetFields = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  };

  const switchTab = (t) => {
    resetFields();
    setTab(t);
  };

  // ── Sign Up ────────────────────────────────
  const handleSignUp = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Passwords don't match", 'Make sure both passwords are the same.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Password too short', 'Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;

      setVerifyNotice(true);
      switchTab('login');
    } catch (err) {
      Alert.alert('Sign up failed', err.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Log In ─────────────────────────────────
  const handleLogIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;
      onAuth?.(data.session);
    } catch (err) {
      Alert.alert('Log in failed', err.message ?? 'Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // ── Google OAuth ───────────────────────────
  const handleGoogle = async () => {
    setLoading(true);
    try {
      const redirectTo = Linking.createURL('/');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (data?.url) {
        // Open the auth session. The actual code exchange is handled
        // globally in _layout.tsx's Linking listener — we just need to
        // open the browser and let it redirect back into the app.
        await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        // onAuthStateChange (SIGNED_IN) in index.tsx fires once
        // _layout.tsx finishes exchanging the code for a session.
      }
    } catch (err) {
      Alert.alert('Google sign in failed', err.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.screen, { backgroundColor: C.bg }]} behavior="height">
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Brand ── */}
        <View style={styles.brand}>
          <Text style={styles.brandLogo}>🌊</Text>
          <Text style={styles.brandName}>Peolia</Text>
          <Text style={[styles.brandTagline, { color: C.textMuted }]}>
            The world's opinion. In real time.
          </Text>
        </View>

        {/* ── Toggle ── */}
        <View style={[styles.toggle, { backgroundColor: C.surfaceAlt, borderColor: C.border }]}>
          {['login', 'signup'].map((t) => {
            const active = tab === t;
            return (
              <TouchableOpacity
                key={t}
                style={[styles.toggleBtn, active && { backgroundColor: C.accent }]}
                onPress={() => switchTab(t)}
                activeOpacity={0.8}
              >
                <Text style={[styles.toggleText, { color: active ? '#FFFFFF' : C.textMuted }]}>
                  {t === 'login' ? 'Log In' : 'Sign Up'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Verification notice (after sign up) ── */}
        {verifyNotice && tab === 'login' && (
          <View style={[styles.notice, { backgroundColor: C.accentLight, borderColor: C.accentMid }]}>
            <Text style={[styles.noticeText, { color: C.accent }]}>
              ✅ Check your inbox — tap the link to verify, then log in here.
            </Text>
          </View>
        )}

        {/* ── Form ── */}
        <View style={styles.form}>
          <TextInput
            style={[styles.input, { backgroundColor: C.surface, borderColor: C.border, color: C.textPrimary }]}
            placeholder="Email"
            placeholderTextColor={C.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={[styles.input, { backgroundColor: C.surface, borderColor: C.border, color: C.textPrimary }]}
            placeholder="Password"
            placeholderTextColor={C.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />
          {tab === 'signup' && (
            <TextInput
              style={[styles.input, { backgroundColor: C.surface, borderColor: C.border, color: C.textPrimary }]}
              placeholder="Confirm password"
              placeholderTextColor={C.textMuted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          )}

          {/* ── Primary CTA ── */}
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: C.accent }, loading && styles.disabled]}
            onPress={tab === 'login' ? handleLogIn : handleSignUp}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {tab === 'login' ? 'Log In' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>

          {/* ── Divider ── */}
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: C.border }]} />
            <Text style={[styles.dividerText, { color: C.textMuted }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: C.border }]} />
          </View>

          {/* ── Google ── */}
          <TouchableOpacity
            style={[styles.googleBtn, { backgroundColor: C.surface, borderColor: C.border }]}
            onPress={handleGoogle}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.googleG}>G</Text>
            <Text style={[styles.googleText, { color: C.textPrimary }]}>
              Continue with Google
            </Text>
          </TouchableOpacity>

          {/* ── Guest ── */}
          <TouchableOpacity style={styles.guestBtn} onPress={onGuest} activeOpacity={0.7}>
            <Text style={[styles.guestText, { color: C.textMuted }]}>
              Browse as Guest
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: ms(24),
    paddingVertical: vs(32),
  },
  brand: {
    alignItems: 'center',
    marginBottom: vs(28),
  },
  brandLogo: {
    fontSize: fs(44),
    marginBottom: vs(6),
  },
  brandName: {
    fontSize: fs(26),
    fontWeight: '800',
    color: C.textPrimary,
    letterSpacing: 0.5,
  },
  brandTagline: {
    fontSize: fs(11),
    fontWeight: '500',
    marginTop: vs(4),
  },
  toggle: {
    flexDirection: 'row',
    borderRadius: s(30),
    borderWidth: 0.5,
    padding: s(3),
    marginBottom: vs(16),
  },
  toggleBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: vs(8),
    borderRadius: s(26),
  },
  toggleText: {
    fontSize: fs(12),
    fontWeight: '700',
  },
  notice: {
    borderRadius: s(10),
    borderWidth: 1,
    paddingHorizontal: ms(12),
    paddingVertical: vs(8),
    marginBottom: vs(12),
  },
  noticeText: {
    fontSize: fs(10),
    fontWeight: '600',
    lineHeight: fs(15),
  },
  form: {
    gap: vs(10),
  },
  input: {
    borderWidth: 1,
    borderRadius: s(12),
    paddingHorizontal: ms(14),
    paddingVertical: vs(12),
    fontSize: fs(13),
  },
  primaryBtn: {
    borderRadius: s(30),
    paddingVertical: vs(13),
    alignItems: 'center',
    marginTop: vs(4),
  },
  primaryBtnText: {
    fontSize: fs(13),
    fontWeight: '800',
    color: '#FFFFFF',
  },
  disabled: {
    opacity: 0.6,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
    marginVertical: vs(2),
  },
  dividerLine: {
    flex: 1,
    height: 0.5,
  },
  dividerText: {
    fontSize: fs(10),
    fontWeight: '600',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: s(30),
    paddingVertical: vs(12),
    gap: ms(8),
  },
  googleG: {
    fontSize: fs(14),
    fontWeight: '800',
    color: '#4285F4',
  },
  googleText: {
    fontSize: fs(12),
    fontWeight: '700',
  },
  guestBtn: {
    alignItems: 'center',
    paddingVertical: vs(10),
  },
  guestText: {
    fontSize: fs(11),
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
