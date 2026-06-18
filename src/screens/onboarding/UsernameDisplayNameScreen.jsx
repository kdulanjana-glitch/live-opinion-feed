// ─────────────────────────────────────────────
// Peolia — Onboarding / UsernameDisplayNameScreen (Step 1 of 4)
// src/screens/onboarding/UsernameDisplayNameScreen.jsx
//
// Pick username (real-time duplicate check, debounced 600ms) + display name.
//
// Props: onDone: () => void, userId: string
// ─────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, useColorScheme,
  Alert, ActivityIndicator,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { getPeoliaColors } from '../../constants/peoliaTheme';
import { fs, ms, vs, s } from '../../utils/peoliaScale';

const DISPLAY_MAX = 40;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export default function UsernameDisplayNameScreen({ onDone, userId }) {
  const scheme = useColorScheme();
  const C = getPeoliaColors(scheme);
  const st = makeStyles(C);

  const [username,    setUsername]    = useState('');
  const [displayName, setDisplayName] = useState('');
  const [status,      setStatus]      = useState('');   // ''|checking|available|taken|short|invalid
  const [saving,      setSaving]      = useState(false);
  const [uid,         setUid]         = useState(userId || null);

  // Resolve the auth user id ourselves — the prop can arrive empty if this
  // screen renders before the session lands, and an empty id breaks every query.
  useEffect(() => {
    if (userId) { setUid(userId); return; }
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setUid(data?.user?.id ?? null);
    });
    return () => { active = false; };
  }, [userId]);

  // Resuming an unfinished onboarding? Prefill the username/display name already
  // on the row so the user can continue with them instead of being forced to
  // "change" a username they already have (which the cooldown would then block).
  useEffect(() => {
    if (!uid) return;
    let active = true;
    supabase
      .from('users')
      .select('username, display_name')
      .eq('id', uid)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        if (data.username)     setUsername((cur) => cur || data.username);
        if (data.display_name) setDisplayName((cur) => cur || data.display_name);
      });
    return () => { active = false; };
  }, [uid]);

  // ── Real-time duplicate check (debounced 600ms) ──
  useEffect(() => {
    const u = username.trim();
    if (!u)              { setStatus('');        return; }
    if (u.length < 3)    { setStatus('short');   return; }
    if (!USERNAME_RE.test(u)) { setStatus('invalid'); return; }
    if (!uid)            { setStatus('');        return; }   // no id yet — don't fire a broken query

    setStatus('checking');
    let active = true;
    const t = setTimeout(async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('username', u)
        .neq('id', uid);
      if (!active) return;   // resolved after unmount/next keystroke — drop it
      if (error) { setStatus(''); return; }
      setStatus((data?.length ?? 0) > 0 ? 'taken' : 'available');
    }, 600);

    return () => { active = false; clearTimeout(t); };
  }, [username, uid]);

  const statusMeta = {
    checking:  { text: 'Checking...',                          color: C.textMuted },
    available: { text: '✓ Available',                          color: C.yesChosen },
    taken:     { text: '✗ Already taken',                      color: C.nahChosen },
    short:     { text: 'Must be at least 3 characters',        color: C.nahChosen },
    invalid:   { text: 'Only letters, numbers and underscores', color: C.nahChosen },
  }[status];

  const canContinue = status === 'available' && displayName.trim().length > 0 && !saving;

  const handleContinue = async () => {
    if (!canContinue) return;
    if (!uid) { Alert.alert('Just a moment', 'Still signing you in — try again in a second.'); return; }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ username: username.trim(), display_name: displayName.trim() })
        .eq('id', uid);
      if (error) {
        if (error.code === '23505') { Alert.alert('Username taken', 'That username was just taken — try another.'); return; }
        throw error;
      }
      onDone?.();
    } catch (err) {
      Alert.alert('Could not save', err.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={st.screen}
      contentContainerStyle={st.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={st.step}>Step 1 of 4</Text>
      <Text style={st.title}>Choose your identity</Text>
      <Text style={st.subtitle}>This is how citizens know you in Peolia.</Text>

      {/* Username */}
      <Text style={st.label}>Username</Text>
      <Text style={st.helper}>Your unique handle — @username</Text>
      <View style={st.inputRow}>
        <Text style={st.prefix}>@</Text>
        <TextInput
          style={st.input}
          value={username}
          onChangeText={setUsername}
          placeholder="username"
          placeholderTextColor={C.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
        />
      </View>
      {!!statusMeta && (
        <Text style={[st.status, { color: statusMeta.color }]}>{statusMeta.text}</Text>
      )}
      <Text style={st.cooldownNote}>You can change this later, but only once every 14 days.</Text>

      {/* Display name */}
      <Text style={[st.label, st.labelSpaced]}>Display Name</Text>
      <Text style={st.helper}>Your real or preferred name — visible on your profile</Text>
      <TextInput
        style={[st.input, st.inputBox]}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Your name"
        placeholderTextColor={C.textMuted}
        maxLength={DISPLAY_MAX}
      />
      <Text style={st.charCount}>{displayName.length} / {DISPLAY_MAX}</Text>

      {/* Continue */}
      <TouchableOpacity
        style={[st.continueBtn, !canContinue && st.continueDisabled]}
        onPress={handleContinue}
        disabled={!canContinue}
        activeOpacity={0.85}
      >
        {saving
          ? <ActivityIndicator color="#FFFFFF" size="small" />
          : <Text style={st.continueText}>Continue</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  screen:  { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: ms(24), paddingTop: vs(56), paddingBottom: vs(32) },
  step:     { fontSize: fs(10), color: C.textMuted },
  title:    { fontSize: fs(22), fontWeight: '800', color: C.textPrimary, marginTop: vs(8) },
  subtitle: { fontSize: fs(12), color: C.textSecondary, marginTop: vs(4) },
  label:       { fontSize: fs(10), fontWeight: '700', color: C.textSecondary, marginTop: vs(20) },
  labelSpaced: { marginTop: vs(24) },
  helper:   { fontSize: fs(9), color: C.textMuted, marginBottom: vs(6) },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: s(10), paddingHorizontal: ms(12),
  },
  prefix: { fontSize: fs(13), color: C.textMuted, marginRight: ms(4) },
  input:  { flex: 1, paddingVertical: vs(11), fontSize: fs(13), color: C.textPrimary },
  inputBox: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: s(10), paddingHorizontal: ms(12),
  },
  status:   { fontSize: fs(9), fontWeight: '600', marginTop: vs(5) },
  cooldownNote: { fontSize: fs(9), color: C.textMuted, marginTop: vs(5) },
  charCount: { fontSize: fs(8), color: C.textMuted, textAlign: 'right', marginTop: vs(4) },
  continueBtn: {
    backgroundColor: C.accent, paddingVertical: vs(14), borderRadius: s(30),
    alignItems: 'center', marginTop: vs(28),
  },
  continueDisabled: { opacity: 0.5 },
  continueText: { fontSize: fs(13), fontWeight: '800', color: '#FFFFFF' },
});
