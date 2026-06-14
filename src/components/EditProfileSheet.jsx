// ─────────────────────────────────────────────
// Peolia — EditProfileSheet
// src/components/EditProfileSheet.jsx
//
// Own-profile editor. Public fields (display_name, bio, avatar) → users.
// Private fields (phone, birthday, gender) → user_private (own-row RLS).
// Username + email are shown read-only (cannot be changed here).
// Optional in-app password change via supabase.auth.updateUser.
// ─────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Modal, KeyboardAvoidingView, Platform,
  useColorScheme, ActivityIndicator, Alert, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { getPeoliaColors } from '../constants/peoliaTheme';
import { fs, ms, vs, s, SCREEN_HEIGHT } from '../utils/peoliaScale';

const DISPLAY_MAX = 30;
const BIO_MAX     = 150;
const GENDERS     = ['Male', 'Female', 'Other', 'Prefer not to say'];

export default function EditProfileSheet({ visible, onClose, initial, onSaved }) {
  const scheme = useColorScheme();
  const C  = getPeoliaColors(scheme);
  const st = makeStyles(C);
  const insets = useSafeAreaInsets();

  const [username,    setUsername]    = useState('');   // read-only
  const [email,       setEmail]       = useState('');   // read-only (auth)
  const [displayName, setDisplayName] = useState('');
  const [bio,         setBio]         = useState('');
  const [phone,       setPhone]       = useState('');
  const [birthday,    setBirthday]    = useState('');
  const [gender,      setGender]      = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPw,   setConfirmPw]   = useState('');
  const [avatarUrl,   setAvatarUrl]   = useState(null);
  const [newAvatar,   setNewAvatar]   = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState(null);

  // Re-seed every time the sheet opens; pull email (auth) + private fields
  useEffect(() => {
    if (!visible) return;
    setUsername(initial?.username ?? '');
    setDisplayName(initial?.displayName ?? '');
    setBio(initial?.bio ?? '');
    setAvatarUrl(initial?.avatarUrl ?? null);
    setNewAvatar(null);
    setNewPassword('');
    setConfirmPw('');
    setError(null);

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setEmail(user?.email ?? '');
      if (!user) return;
      const { data } = await supabase
        .from('user_private')
        .select('phone, birthday, gender')
        .eq('user_id', user.id)
        .maybeSingle();
      setPhone(data?.phone ?? '');
      setBirthday(data?.birthday ?? '');
      setGender(data?.gender ?? null);
    })();
  }, [visible, initial]);

  const previewUri = newAvatar?.uri ?? avatarUrl;
  const letter     = (username || '?')[0].toUpperCase();

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85, base64: true,
    });
    if (!result.canceled) setNewAvatar(result.assets[0]);
  };

  // Decode the picker's base64 → ArrayBuffer (fetch().arrayBuffer() is broken in RN)
  const uploadAvatar = async (userId) => {
    if (!newAvatar?.base64) throw new Error('No image data to upload');
    const ext  = (newAvatar.uri.split('.').pop() || 'jpg').toLowerCase();
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('senti-images')
      .upload(path, decode(newAvatar.base64), { contentType: newAvatar.mimeType ?? 'image/jpeg' });
    if (error) throw error;
    return supabase.storage.from('senti-images').getPublicUrl(path).data.publicUrl;
  };

  const handleSave = async () => {
    if (saving) return;

    const bday = birthday.trim();
    if (bday && !/^\d{4}-\d{2}-\d{2}$/.test(bday)) {
      setError('Birthday must be in YYYY-MM-DD format.');
      return;
    }
    if (newPassword || confirmPw) {
      if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
      if (newPassword !== confirmPw) { setError('Passwords do not match.'); return; }
    }

    setSaving(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('You need to be signed in.'); return; }

      let uploadedAvatarUrl;
      if (newAvatar) {
        try {
          uploadedAvatarUrl = await uploadAvatar(user.id);
        } catch (e) {
          console.error('EditProfileSheet avatar upload error', e);
          setError('Could not upload the photo. Please try again.');
          return;
        }
      }

      // Public profile fields (username is NOT updated here)
      const updates = {
        display_name: displayName.trim() || null,
        bio:          bio.trim() || null,
        ...(uploadedAvatarUrl ? { avatar_url: uploadedAvatarUrl } : {}),
      };
      const { error: dbError } = await supabase.from('users').update(updates).eq('id', user.id);
      if (dbError) {
        console.error('EditProfileSheet save error', dbError);
        setError('Could not save. Please try again.');
        return;
      }

      // Private fields
      const { error: pErr } = await supabase.from('user_private').upsert({
        user_id:  user.id,
        phone:    phone.trim() || null,
        birthday: bday || null,
        gender:   gender || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (pErr) {
        console.error('EditProfileSheet user_private error', pErr);
        setError('Could not save contact details. Please try again.');
        return;
      }

      // Optional password change
      if (newPassword) {
        const { error: pwErr } = await supabase.auth.updateUser({ password: newPassword });
        if (pwErr) {
          console.error('EditProfileSheet password error', pwErr);
          setError(pwErr.message || 'Could not update password.');
          return;
        }
      }

      onSaved?.({ username, ...updates });
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={st.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ width: '100%' }}
        >
          <View style={[st.sheet, { paddingBottom: vs(16) + insets.bottom }]}>
            <View style={st.handle} />
            <View style={st.header}>
              <Text style={st.title}>Edit profile</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={st.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={st.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Avatar */}
              <View style={st.avatarRow}>
                <TouchableOpacity style={st.avatarWrap} onPress={pickAvatar} activeOpacity={0.8}>
                  <View style={st.avatarCircle}>
                    {previewUri ? (
                      <Image source={{ uri: previewUri }} style={st.avatarFill} resizeMode="cover" />
                    ) : (
                      <Text style={st.avatarLetter}>{letter}</Text>
                    )}
                  </View>
                  <View style={st.avatarEdit}><Text style={st.avatarEditIcon}>📷</Text></View>
                </TouchableOpacity>
                <TouchableOpacity onPress={pickAvatar} activeOpacity={0.7}>
                  <Text style={st.avatarChange}>Change photo</Text>
                </TouchableOpacity>
              </View>

              {/* Username (read-only) */}
              <Text style={st.label}>Username</Text>
              <View style={[st.input, st.inputDisabled]}>
                <Text style={st.disabledText}>@{username || '—'}</Text>
              </View>

              {/* Email (read-only) */}
              <Text style={st.label}>Email</Text>
              <View style={[st.input, st.inputDisabled]}>
                <Text style={st.disabledText}>{email || '—'}</Text>
              </View>

              {/* Display name */}
              <Text style={st.label}>Display name</Text>
              <TextInput
                style={st.input} value={displayName} onChangeText={setDisplayName}
                placeholder="How your name appears" placeholderTextColor={C.textMuted} maxLength={DISPLAY_MAX}
              />

              {/* Bio */}
              <View style={st.labelRow}>
                <Text style={st.label}>Bio</Text>
                <Text style={st.charCount}>{bio.length} / {BIO_MAX}</Text>
              </View>
              <TextInput
                style={[st.input, st.inputBio]} value={bio} onChangeText={setBio}
                placeholder="Tell citizens about yourself..." placeholderTextColor={C.textMuted}
                multiline maxLength={BIO_MAX} textAlignVertical="top"
              />

              {/* Phone */}
              <Text style={st.label}>Phone</Text>
              <TextInput
                style={st.input} value={phone} onChangeText={setPhone}
                placeholder="Phone number" placeholderTextColor={C.textMuted} keyboardType="phone-pad"
              />

              {/* Birthday */}
              <Text style={st.label}>Birthday</Text>
              <TextInput
                style={st.input} value={birthday} onChangeText={setBirthday}
                placeholder="YYYY-MM-DD" placeholderTextColor={C.textMuted}
                autoCapitalize="none" autoCorrect={false}
              />

              {/* Gender */}
              <Text style={st.label}>Gender</Text>
              <View style={st.genderRow}>
                {GENDERS.map((g) => {
                  const active = gender === g;
                  return (
                    <TouchableOpacity
                      key={g}
                      style={[st.genderPill, active ? st.genderPillActive : { borderColor: C.border }]}
                      onPress={() => setGender(active ? null : g)}
                      activeOpacity={0.7}
                    >
                      <Text style={[st.genderText, active && st.genderTextActive]}>{g}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Change password */}
              <Text style={[st.label, st.sectionLabel]}>Change password</Text>
              <TextInput
                style={st.input} value={newPassword} onChangeText={setNewPassword}
                placeholder="New password" placeholderTextColor={C.textMuted}
                secureTextEntry autoCapitalize="none"
              />
              <TextInput
                style={[st.input, { marginTop: vs(8) }]} value={confirmPw} onChangeText={setConfirmPw}
                placeholder="Confirm new password" placeholderTextColor={C.textMuted}
                secureTextEntry autoCapitalize="none"
              />

              {error && <Text style={st.error}>{error}</Text>}

              <TouchableOpacity
                style={[st.saveBtn, saving && st.saveBtnDisabled]}
                onPress={handleSave} disabled={saving} activeOpacity={0.8}
              >
                {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={st.saveText}>Save</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const makeStyles = (C) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.sheetBg,
    borderTopLeftRadius: ms(20), borderTopRightRadius: ms(20),
    borderTopWidth: 0.5, borderColor: C.sheetBorder,
    paddingHorizontal: ms(18), paddingTop: vs(10),
  },
  scroll: { maxHeight: Math.round(SCREEN_HEIGHT * 0.66) },
  handle: {
    width: ms(36), height: vs(4), borderRadius: ms(2),
    backgroundColor: C.border, alignSelf: 'center', marginBottom: vs(12),
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: vs(10) },
  title:    { fontSize: fs(17), fontWeight: '700', color: C.textPrimary },
  closeBtn: { fontSize: fs(18), color: C.textSecondary, padding: ms(4) },
  avatarRow:   { alignItems: 'center', gap: vs(6), marginBottom: vs(6) },
  avatarWrap:  { position: 'relative', width: s(76), height: s(76) },
  avatarCircle: {
    width: '100%', height: '100%', borderRadius: s(38), overflow: 'hidden',
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
  },
  avatarFill:   { width: '100%', height: '100%' },
  avatarLetter: { fontSize: fs(30), fontWeight: '800', color: '#FFFFFF' },
  avatarEdit: {
    position: 'absolute', bottom: 0, right: 0,
    width: s(26), height: s(26), borderRadius: s(13),
    backgroundColor: C.sheetBg, borderWidth: 1.5, borderColor: C.sheetBg,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarEditIcon: { fontSize: fs(13) },
  avatarChange:   { fontSize: fs(13), fontWeight: '700', color: C.accent },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label:    { fontSize: fs(13), fontWeight: '700', color: C.textSecondary, marginTop: vs(10), marginBottom: vs(5) },
  sectionLabel: { marginTop: vs(16) },
  charCount: { fontSize: fs(12), fontWeight: '600', color: C.textMuted, marginTop: vs(10) },
  input: {
    backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border, borderRadius: ms(12),
    paddingHorizontal: ms(12), paddingVertical: vs(9), fontSize: fs(14), color: C.textPrimary,
  },
  inputDisabled: { backgroundColor: C.border, justifyContent: 'center' },
  disabledText:  { fontSize: fs(14), color: C.textMuted },
  inputBio: { minHeight: vs(70) },
  genderRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: ms(8) },
  genderPill: { paddingVertical: vs(7), paddingHorizontal: ms(14), borderRadius: ms(20), borderWidth: 1 },
  genderPillActive: { backgroundColor: C.accent, borderColor: C.accent },
  genderText:       { fontSize: fs(13), fontWeight: '600', color: C.textSecondary },
  genderTextActive: { color: '#FFFFFF' },
  error: { fontSize: fs(13), fontWeight: '600', color: C.nahText, marginTop: vs(10), textAlign: 'center' },
  saveBtn: { marginTop: vs(16), paddingVertical: vs(12), borderRadius: ms(14), backgroundColor: C.accent, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { fontSize: fs(15), fontWeight: '700', color: '#FFFFFF' },
});
