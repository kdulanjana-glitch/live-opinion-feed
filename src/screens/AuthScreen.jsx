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
import CountryPicker from 'react-native-country-picker-modal';
import { supabase } from '../lib/supabase';
import { getPeoliaColors } from '../constants/peoliaTheme';
import { fs, ms, vs, s } from '../utils/peoliaScale';

// MUST match the phone-signup Edge Function transform EXACTLY: digits only + domain.
const phoneToSyntheticEmail = (e164Phone) =>
  `${e164Phone.replace(/[^0-9]/g, '')}@phone.peolia.invalid`;

export default function AuthScreen({ onAuth, onGuest }) {
  const scheme = useColorScheme();
  const C = getPeoliaColors(scheme);
  const styles = makeStyles(C);

  const [tab,             setTab]             = useState('login');
  const [method,          setMethod]          = useState('email');  // 'email' | 'phone' — shared by both tabs
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [countryCode,     setCountryCode]     = useState('AE');
  const [callingCode,     setCallingCode]     = useState('971');
  const [pickerVisible,   setPickerVisible]   = useState(false);
  const [phone,           setPhone]           = useState('');
  const [loading,         setLoading]         = useState(false);
  const [verifyNotice,    setVerifyNotice]    = useState(false);

  const resetFields = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setPhone('');
  };

  const switchTab = (t) => {
    resetFields();
    setTab(t);
  };

  // ── Sign Up ────────────────────────────────
  const handleSignUp = async () => {
    if (!password) {
      Alert.alert('Missing fields', 'Please enter a password.');
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
      if (method === 'phone') {
        const phoneDigits = phone.replace(/\D/g, '');
        if (phoneDigits.length < 6) { Alert.alert('Missing phone', 'Please enter your phone number.'); return; }
        const fullPhone = '+' + callingCode + phoneDigits;

        // Create the account via the phone-signup Edge Function (admin createUser
        // with a synthetic email). The function always returns 200 with
        // { success, error? }, so check success rather than the HTTP status.
        const body = { phone: fullPhone, password };
        const recovery = email.trim();
        if (recovery) body.email = recovery;   // optional recovery contact
        const { data, error } = await supabase.functions.invoke('phone-signup', { body });
        if (error || !data?.success) {
          Alert.alert('Sign up failed', data?.error ?? error?.message ?? 'Please try again.');
          return;
        }

        // No email verification for phone — sign in immediately.
        const syntheticEmail = phoneToSyntheticEmail(fullPhone);
        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({ email: syntheticEmail, password });
        if (signInError) throw signInError;
        onAuth?.(signInData.session);   // same contract as the email log-in path
        return;
      }

      // Email path
      if (!email.trim()) { Alert.alert('Missing fields', 'Please enter your email.'); return; }
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
    if (!password) {
      Alert.alert('Missing fields', 'Please enter your password.');
      return;
    }

    let signInEmail;
    if (method === 'phone') {
      const phoneDigits = phone.replace(/\D/g, '');
      if (phoneDigits.length < 6) { Alert.alert('Missing phone', 'Please enter your phone number.'); return; }
      signInEmail = phoneToSyntheticEmail('+' + callingCode + phoneDigits);
    } else {
      if (!email.trim()) { Alert.alert('Missing fields', 'Please enter your email and password.'); return; }
      signInEmail = email.trim().toLowerCase();
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: signInEmail, password });
      if (error) throw error;
      onAuth?.(data.session);
    } catch (err) {
      // Generic message — don't reveal whether the phone/email exists.
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

        {/* ── Method toggle (Email / Phone) — shared by both tabs ── */}
        <View style={styles.methodToggle}>
          {['email', 'phone'].map((m) => {
            const active = method === m;
            return (
              <TouchableOpacity
                key={m}
                style={[styles.methodBtn, active && { backgroundColor: C.surfaceAlt, borderColor: C.border }]}
                onPress={() => setMethod(m)}
                activeOpacity={0.8}
              >
                <Text style={[styles.methodText, { color: active ? C.textPrimary : C.textMuted }]}>
                  {m === 'email' ? 'Email' : 'Phone'}
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
          {method === 'email' ? (
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
          ) : (
            <View style={styles.phoneRow}>
              <TouchableOpacity
                style={[styles.countryBox, { backgroundColor: C.surface, borderColor: C.border }]}
                onPress={() => setPickerVisible(true)}
                activeOpacity={0.7}
              >
                <CountryPicker
                  countryCode={countryCode}
                  withFlag
                  withFilter
                  withAlphaFilter
                  withCallingCode
                  visible={pickerVisible}
                  onClose={() => setPickerVisible(false)}
                  onSelect={(country) => {
                    setCountryCode(country.cca2);
                    setCallingCode(country.callingCode?.[0] ?? '');
                    setPickerVisible(false);
                  }}
                />
                <Text style={[styles.callingCode, { color: C.textPrimary }]}>+{callingCode}</Text>
              </TouchableOpacity>
              <TextInput
                style={[styles.input, styles.phoneInput, { backgroundColor: C.surface, borderColor: C.border, color: C.textPrimary }]}
                placeholder="501234567"
                placeholderTextColor={C.textMuted}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}
          {/* Optional recovery email — phone signup only (phone accounts have a
              synthetic login email, so a real one is useful for recovery) */}
          {tab === 'signup' && method === 'phone' && (
            <TextInput
              style={[styles.input, { backgroundColor: C.surface, borderColor: C.border, color: C.textPrimary }]}
              placeholder="Email (optional, for recovery)"
              placeholderTextColor={C.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}
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
  methodToggle: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: ms(6),
    marginBottom: vs(14),
  },
  methodBtn: {
    paddingVertical: vs(6),
    paddingHorizontal: ms(18),
    borderRadius: s(20),
    borderWidth: 0.5,
    borderColor: 'transparent',
  },
  methodText: {
    fontSize: fs(11),
    fontWeight: '700',
  },
  phoneRow: {
    flexDirection: 'row',
    gap: ms(8),
  },
  countryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ms(4),
    borderWidth: 1,
    borderRadius: s(12),
    paddingHorizontal: ms(12),
  },
  callingCode: {
    fontSize: fs(13),
    fontWeight: '600',
  },
  phoneInput: {
    flex: 1,
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
