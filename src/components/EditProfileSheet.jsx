// ─────────────────────────────────────────────
// Peolia — EditProfileSheet
// src/components/EditProfileSheet.jsx
//
// Bottom sheet for editing the citizen's own profile.
// Updates public.users: username, display_name, bio
// Requires the users_update_own RLS policy + the
// display_name / bio columns (see supabase notes).
// ─────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, KeyboardAvoidingView, Platform,
  useColorScheme, ActivityIndicator, Alert, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { getPeoliaColors } from '../constants/peoliaTheme';
import { fs, ms, vs, s } from '../utils/peoliaScale';

const USERNAME_MAX = 20;
const DISPLAY_MAX  = 30;
const BIO_MAX      = 150;

export default function EditProfileSheet({ visible, onClose, initial, onSaved }) {
  const scheme = useColorScheme();
  const C  = getPeoliaColors(scheme);
  const st = makeStyles(C);
  const insets = useSafeAreaInsets();

  const [username,    setUsername]    = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio,         setBio]         = useState('');
  const [avatarUrl,   setAvatarUrl]   = useState(null);  // current saved/displayed avatar
  const [newAvatar,   setNewAvatar]   = useState(null);  // freshly picked asset, uploaded on Save
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState(null);

  // Re-seed fields from current profile every time the sheet opens
  useEffect(() => {
    if (visible) {
      setUsername(initial?.username ?? '');
      setDisplayName(initial?.displayName ?? '');
      setBio(initial?.bio ?? '');
      setAvatarUrl(initial?.avatarUrl ?? null);
      setNewAvatar(null);
      setError(null);
    }
  }, [visible, initial]);

  const previewUri = newAvatar?.uri ?? avatarUrl;   // what the avatar circle shows
  const letter     = (username || '?')[0].toUpperCase();

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],         // square avatar (display clips it to a circle)
      quality: 0.85,
      base64: true,           // needed for upload (RN can't read the file via fetch)
    });
    if (!result.canceled) setNewAvatar(result.assets[0]);
  };

  // Upload the picked avatar to senti-images/{userId}/avatar-*.jpg → public URL.
  // Decode the picker's base64 → ArrayBuffer. NOTE: fetch(localUri).arrayBuffer() does
  // NOT work in React Native — it yields a ~14-byte stub, not the real file bytes.
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
    const uname = username.trim().toLowerCase();
    if (uname.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(uname)) {
      setError('Username can only use letters, numbers, and underscores.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('You need to be signed in.'); return; }

      // Upload a newly-picked avatar first; abort save on upload failure
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

      const updates = {
        username:     uname,
        display_name: displayName.trim() || null,
        bio:          bio.trim() || null,
        // only set avatar_url when a new photo was picked (don't wipe the existing one)
        ...(uploadedAvatarUrl ? { avatar_url: uploadedAvatarUrl } : {}),
      };
      const { error: dbError } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id);

      if (dbError) {
        if (dbError.code === '23505') setError('That username is already taken.');
        else {
          console.error('EditProfileSheet save error', dbError);
          setError('Could not save. Please try again.');
        }
        return;
      }

      onSaved?.(updates);
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={st.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ width: '100%' }}
        >
          <View style={[st.sheet, { paddingBottom: vs(20) + insets.bottom }]}>
            <View style={st.handle} />

            {/* Header */}
            <View style={st.header}>
              <Text style={st.title}>Edit profile</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={st.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

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
                <View style={st.avatarEdit}>
                  <Text style={st.avatarEditIcon}>📷</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={pickAvatar} activeOpacity={0.7}>
                <Text style={st.avatarChange}>Change photo</Text>
              </TouchableOpacity>
            </View>

            {/* Username */}
            <Text style={st.label}>Username</Text>
            <TextInput
              style={st.input}
              value={username}
              onChangeText={setUsername}
              placeholder="username"
              placeholderTextColor={C.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={USERNAME_MAX}
            />

            {/* Display name */}
            <Text style={st.label}>Display name</Text>
            <TextInput
              style={st.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="How your name appears"
              placeholderTextColor={C.textMuted}
              maxLength={DISPLAY_MAX}
            />

            {/* Bio */}
            <View style={st.labelRow}>
              <Text style={st.label}>Bio</Text>
              <Text style={st.charCount}>{bio.length} / {BIO_MAX}</Text>
            </View>
            <TextInput
              style={[st.input, st.inputBio]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell citizens about yourself..."
              placeholderTextColor={C.textMuted}
              multiline
              maxLength={BIO_MAX}
              textAlignVertical="top"
            />

            {error && <Text style={st.error}>{error}</Text>}

            {/* Save */}
            <TouchableOpacity
              style={[st.saveBtn, saving && st.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : <Text style={st.saveText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const makeStyles = (C) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.sheetBg,
    borderTopLeftRadius: ms(20),
    borderTopRightRadius: ms(20),
    borderTopWidth: 0.5,
    borderColor: C.sheetBorder,
    paddingHorizontal: ms(18),
  },
  handle: {
    width: ms(36),
    height: vs(4),
    borderRadius: ms(2),
    backgroundColor: C.border,
    alignSelf: 'center',
    marginTop: vs(10),
    marginBottom: vs(12),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(10),
  },
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
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: fs(13), fontWeight: '700', color: C.textSecondary,
    marginTop: vs(10), marginBottom: vs(5),
  },
  charCount: { fontSize: fs(12), fontWeight: '600', color: C.textMuted, marginTop: vs(10) },
  input: {
    backgroundColor: C.surfaceAlt,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: ms(12),
    paddingHorizontal: ms(12),
    paddingVertical: vs(9),
    fontSize: fs(14),
    color: C.textPrimary,
  },
  inputBio: { minHeight: vs(70) },
  error: {
    fontSize: fs(13), fontWeight: '600', color: C.nahText,
    marginTop: vs(10), textAlign: 'center',
  },
  saveBtn: {
    marginTop: vs(14),
    paddingVertical: vs(12),
    borderRadius: ms(14),
    backgroundColor: C.accent,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { fontSize: fs(15), fontWeight: '700', color: '#FFFFFF' },
});
