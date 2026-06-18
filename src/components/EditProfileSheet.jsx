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
import { Picker } from '@react-native-picker/picker';
import CountryPicker from 'react-native-country-picker-modal';
import { decode } from 'base64-arraybuffer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { getPeoliaColors } from '../constants/peoliaTheme';
import { fs, ms, vs, s, SCREEN_HEIGHT } from '../utils/peoliaScale';
import { passwordStrength } from '../utils/passwordStrength';

const DISPLAY_MAX = 30;
const BIO_MAX     = 150;
const PHONE_DOMAIN = '@phone.peolia.invalid';

// Strength score (0–4) → theme colour for the meter.
const pwColor = (C, score) => {
  if (score <= 1) return C.nahChosen;
  if (score === 2) return C.hmmChosen;
  return C.yesChosen;
};

// Canonical gender tokens (stored) + display labels.
const GENDERS = [
  { value: 'male',              label: 'Male' },
  { value: 'female',            label: 'Female' },
  { value: 'other',             label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

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
  const [currentPw,   setCurrentPw]   = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPw,   setConfirmPw]   = useState('');
  const [avatarUrl,   setAvatarUrl]   = useState(null);
  const [newAvatar,   setNewAvatar]   = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState(null);

  // Per-field visibility (the owner decides who can see each one). Default private.
  const [phonePublic,  setPhonePublic]  = useState(false);
  const [dobPublic,    setDobPublic]    = useState(false);
  const [genderPublic, setGenderPublic] = useState(false);

  // Phone is the login identity for phone accounts → only changeable via the
  // phone-change edge function (with current password), never a plain write.
  const [isPhoneAccount, setIsPhoneAccount] = useState(false);
  const [dobLocked,      setDobLocked]      = useState(false);  // DOB is permanent once set

  // Inline "change phone number" sub-form (phone accounts only).
  const [showPhoneChange, setShowPhoneChange] = useState(false);
  const [newPhone,        setNewPhone]        = useState('');   // national digits
  const [phoneChangePw,   setPhoneChangePw]   = useState('');
  const [changingPhone,   setChangingPhone]   = useState(false);

  // Country code + national number (shared; only one phone input shows at a time).
  const [countryCode,   setCountryCode]   = useState('AE');
  const [callingCode,   setCallingCode]   = useState('971');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [phoneNational, setPhoneNational] = useState('');   // email accounts' new number

  // Inline "change email" sub-form (email accounts only).
  const [showEmailChange, setShowEmailChange] = useState(false);
  const [newEmail,        setNewEmail]        = useState('');
  const [changingEmail,   setChangingEmail]   = useState(false);

  const pwStrength = passwordStrength(newPassword);

  // Re-seed every time the sheet opens; pull email (auth) + private fields
  useEffect(() => {
    if (!visible) return;
    setUsername(initial?.username ?? '');
    setDisplayName(initial?.displayName ?? '');
    setBio(initial?.bio ?? '');
    setAvatarUrl(initial?.avatarUrl ?? null);
    setNewAvatar(null);
    setCurrentPw('');
    setNewPassword('');
    setConfirmPw('');
    setError(null);
    setShowPhoneChange(false);
    setNewPhone('');
    setPhoneChangePw('');
    setPhoneNational('');
    setShowEmailChange(false);
    setNewEmail('');

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const mail = user?.email ?? '';
      setEmail(mail);
      setIsPhoneAccount(mail.endsWith(PHONE_DOMAIN));
      if (!user) return;
      const { data } = await supabase
        .from('user_private')
        .select('phone, birthday, gender, phone_public, dob_public, gender_public')
        .eq('user_id', user.id)
        .maybeSingle();
      setPhone(data?.phone ?? '');
      setBirthday(data?.birthday ?? '');
      setGender(data?.gender ?? null);
      setPhonePublic(!!data?.phone_public);
      setDobPublic(!!data?.dob_public);
      setGenderPublic(!!data?.gender_public);
      setDobLocked(!!data?.birthday);  // permanent once set
    })();
  }, [visible, initial]);

  // Phone account: swap the login phone via the edge function (re-auths with pw).
  const handlePhoneChange = async () => {
    if (changingPhone) return;
    const clean = '+' + callingCode + newPhone.replace(/\D/g, '');
    if (!/^\+[1-9]\d{6,14}$/.test(clean)) {
      setError('Enter a valid new phone number.');
      return;
    }
    if (!phoneChangePw) { setError('Enter your current password to change your number.'); return; }
    setChangingPhone(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('phone-change', {
        body: { newPhone: clean, currentPassword: phoneChangePw },
      });
      if (fnErr || !data?.success) {
        setError(data?.error ?? fnErr?.message ?? 'Could not change phone number.');
        return;
      }
      // The edge function swapped the auth email — refresh so the session matches.
      await supabase.auth.refreshSession();
      setPhone(clean);
      setShowPhoneChange(false);
      setNewPhone('');
      setPhoneChangePw('');
      Alert.alert('Phone updated', 'Your phone number has been changed.');
    } catch (e) {
      setError('Could not change phone number. Please try again.');
    } finally {
      setChangingPhone(false);
    }
  };

  // Email account: change the login email via Supabase auth.
  const handleEmailChange = async () => {
    if (changingEmail) return;
    const next = newEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(next)) { setError('Enter a valid email address.'); return; }
    if (next === email.toLowerCase()) { setError('That is already your email.'); return; }
    setChangingEmail(true);
    setError(null);
    try {
      const { error: upErr } = await supabase.auth.updateUser({ email: next });
      if (upErr) { setError(upErr.message || 'Could not change email.'); return; }
      await supabase.auth.refreshSession();
      setEmail(next);
      setShowEmailChange(false);
      setNewEmail('');
      Alert.alert('Email updated', 'Your email has been changed.');
    } catch (e) {
      setError('Could not change email. Please try again.');
    } finally {
      setChangingEmail(false);
    }
  };

  // Country-code + national-number input, matching the onboarding screen.
  const renderPhoneInput = (digits, onChangeDigits) => (
    <View style={st.phoneRow}>
      <TouchableOpacity style={st.countryBox} onPress={() => setPickerVisible(true)} activeOpacity={0.7}>
        <CountryPicker
          countryCode={countryCode}
          withFlag withFilter withAlphaFilter withCallingCode
          visible={pickerVisible}
          onClose={() => setPickerVisible(false)}
          onSelect={(country) => {
            setCountryCode(country.cca2);
            setCallingCode(country.callingCode?.[0] ?? '');
            setPickerVisible(false);
          }}
        />
        <Text style={st.callingCode}>+{callingCode}</Text>
      </TouchableOpacity>
      <TextInput
        style={st.phoneInput}
        value={digits}
        onChangeText={(t) => onChangeDigits(t.replace(/\D/g, ''))}
        placeholder="501234567"
        placeholderTextColor={C.textMuted}
        keyboardType="phone-pad"
      />
    </View>
  );

  const previewUri = newAvatar?.uri ?? avatarUrl;
  const letter     = (username || '?')[0].toUpperCase();

  // Per-field public/private switch. Default state is private (lock).
  const renderVisibility = (isPublic, setPublic) => (
    <TouchableOpacity
      style={[st.visToggle, isPublic ? st.visTogglePublic : st.visTogglePrivate]}
      onPress={() => setPublic(!isPublic)}
      activeOpacity={0.7}
    >
      <Text style={[st.visText, isPublic ? st.visTextPublic : st.visTextPrivate]}>
        {isPublic ? '👁  Visible to others' : '🔒  Only you'}
      </Text>
    </TouchableOpacity>
  );

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

    // Email accounts may set a new phone via the country code + national number.
    // (Phone accounts change their login number through handlePhoneChange only.)
    let phoneToSave;
    if (!isPhoneAccount) {
      const nat = phoneNational.replace(/\D/g, '');
      if (nat) {
        const composed = '+' + callingCode + nat;
        if (!/^\+[1-9]\d{6,14}$/.test(composed)) { setError('Enter a valid phone number.'); return; }
        phoneToSave = composed;
      }
    }

    const wantsPwChange = !!(currentPw || newPassword || confirmPw);
    if (wantsPwChange) {
      if (!currentPw) { setError('Enter your current password.'); return; }
      if (newPassword.length < 6) { setError('New password must be at least 6 characters.'); return; }
      if (newPassword !== confirmPw) { setError('New passwords do not match.'); return; }
    }

    setSaving(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('You need to be signed in.'); return; }

      // Verify the current password BEFORE any writes (so nothing saves on a bad password)
      if (wantsPwChange) {
        const { error: reauthErr } = await supabase.auth.signInWithPassword({ email, password: currentPw });
        if (reauthErr) { setError('Current password is incorrect.'); return; }
      }

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

      // Private fields + per-field visibility. Phone is omitted unless an email
      // account entered a new one — omitted columns aren't overwritten on upsert,
      // so a phone account's login number (and an unchanged number) is preserved.
      const privateRow = {
        user_id:  user.id,
        birthday: bday || null,
        gender:   gender || null,
        phone_public:  phonePublic,
        dob_public:    dobPublic,
        gender_public: genderPublic,
        updated_at: new Date().toISOString(),
      };
      if (phoneToSave) privateRow.phone = phoneToSave;
      const { error: pErr } = await supabase.from('user_private').upsert(privateRow, { onConflict: 'user_id' });
      if (pErr) {
        console.error('EditProfileSheet user_private error', pErr);
        setError('Could not save contact details. Please try again.');
        return;
      }

      // Password change (current password already verified above)
      if (wantsPwChange) {
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

              <Text style={st.sectionHead}>Public profile</Text>

              {/* Username (read-only) */}
              <Text style={st.label}>Username</Text>
              <View style={[st.input, st.inputDisabled]}>
                <Text style={st.disabledText}>@{username || '—'}</Text>
              </View>

              {/* Email — editable for email accounts (phone accounts use a synthetic one) */}
              {!isPhoneAccount && (
                <>
                  <Text style={st.label}>Email</Text>
                  <View style={[st.input, st.inputDisabled]}>
                    <Text style={st.disabledText}>{email || '—'}</Text>
                  </View>
                  {!showEmailChange ? (
                    <TouchableOpacity onPress={() => { setError(null); setShowEmailChange(true); }} activeOpacity={0.7}>
                      <Text style={st.linkAction}>Change email</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={st.subForm}>
                      <TextInput
                        style={st.input} value={newEmail} onChangeText={setNewEmail}
                        placeholder="New email" placeholderTextColor={C.textMuted}
                        keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
                      />
                      <View style={st.subFormRow}>
                        <TouchableOpacity
                          onPress={() => { setShowEmailChange(false); setNewEmail(''); setError(null); }}
                          activeOpacity={0.7}
                        >
                          <Text style={st.subFormCancel}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[st.subFormBtn, changingEmail && st.saveBtnDisabled]}
                          onPress={handleEmailChange} disabled={changingEmail} activeOpacity={0.8}
                        >
                          {changingEmail
                            ? <ActivityIndicator color="#FFFFFF" size="small" />
                            : <Text style={st.subFormBtnText}>Update email</Text>}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </>
              )}

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

              <Text style={st.sectionHead}>Private details</Text>
              <Text style={st.sectionNote}>Private by default. Use the switch under each to let others see it.</Text>

              {/* Phone */}
              <Text style={st.label}>Phone</Text>
              {isPhoneAccount ? (
                <>
                  <View style={[st.input, st.inputDisabled]}>
                    <Text style={st.disabledText}>{phone || '—'}</Text>
                  </View>
                  {!showPhoneChange ? (
                    <TouchableOpacity onPress={() => { setError(null); setShowPhoneChange(true); }} activeOpacity={0.7}>
                      <Text style={st.linkAction}>Change phone number</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={st.subForm}>
                      <Text style={st.helper}>This is also your login. Confirm with your password.</Text>
                      <View style={{ marginTop: vs(8) }}>
                        {renderPhoneInput(newPhone, setNewPhone)}
                      </View>
                      <TextInput
                        style={[st.input, { marginTop: vs(8) }]} value={phoneChangePw} onChangeText={setPhoneChangePw}
                        placeholder="Current password" placeholderTextColor={C.textMuted}
                        secureTextEntry autoCapitalize="none"
                      />
                      <View style={st.subFormRow}>
                        <TouchableOpacity
                          onPress={() => { setShowPhoneChange(false); setNewPhone(''); setPhoneChangePw(''); setError(null); }}
                          activeOpacity={0.7}
                        >
                          <Text style={st.subFormCancel}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[st.subFormBtn, changingPhone && st.saveBtnDisabled]}
                          onPress={handlePhoneChange} disabled={changingPhone} activeOpacity={0.8}
                        >
                          {changingPhone
                            ? <ActivityIndicator color="#FFFFFF" size="small" />
                            : <Text style={st.subFormBtnText}>Update number</Text>}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </>
              ) : (
                <>
                  {!!phone && <Text style={st.helper}>Current: {phone}</Text>}
                  {renderPhoneInput(phoneNational, setPhoneNational)}
                  <Text style={st.helper}>{phone ? 'Enter a new number to replace it.' : 'Optional.'}</Text>
                </>
              )}
              {renderVisibility(phonePublic, setPhonePublic)}

              {/* Birthday — permanent once set */}
              <Text style={st.label}>Date of birth</Text>
              {dobLocked ? (
                <>
                  <View style={[st.input, st.inputDisabled]}>
                    <Text style={st.disabledText}>{birthday || '—'}</Text>
                  </View>
                  <Text style={st.helper}>Set during signup — can't be changed.</Text>
                </>
              ) : (
                <TextInput
                  style={st.input} value={birthday} onChangeText={setBirthday}
                  placeholder="YYYY-MM-DD" placeholderTextColor={C.textMuted}
                  autoCapitalize="none" autoCorrect={false}
                />
              )}
              {renderVisibility(dobPublic, setDobPublic)}

              {/* Gender */}
              <Text style={st.label}>Gender</Text>
              <View style={st.pickerBox}>
                <Picker
                  selectedValue={gender ?? ''}
                  onValueChange={(v) => setGender(v || null)}
                  style={st.picker}
                  dropdownIconColor={C.textMuted}
                >
                  <Picker.Item label="Select…" value="" color={C.textMuted} />
                  {GENDERS.map((g) => (
                    <Picker.Item key={g.value} label={g.label} value={g.value} color={C.textPrimary} />
                  ))}
                </Picker>
              </View>
              {renderVisibility(genderPublic, setGenderPublic)}

              {/* Security */}
              <Text style={st.sectionHead}>Security</Text>
              <Text style={st.label}>Change password</Text>
              <TextInput
                style={st.input} value={currentPw} onChangeText={setCurrentPw}
                placeholder="Current password" placeholderTextColor={C.textMuted}
                secureTextEntry autoCapitalize="none"
              />
              <TextInput
                style={[st.input, { marginTop: vs(8) }]} value={newPassword} onChangeText={setNewPassword}
                placeholder="New password" placeholderTextColor={C.textMuted}
                secureTextEntry autoCapitalize="none"
              />
              {pwStrength.score >= 0 && (
                <View style={st.meterRow}>
                  <View style={st.meterTrack}>
                    {[0, 1, 2, 3].map((i) => (
                      <View
                        key={i}
                        style={[
                          st.meterSeg,
                          i <= pwStrength.score && { backgroundColor: pwColor(C, pwStrength.score) },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={[st.meterLabel, { color: pwColor(C, pwStrength.score) }]}>{pwStrength.label}</Text>
                </View>
              )}
              <TextInput
                style={[st.input, { marginTop: vs(8) }]} value={confirmPw} onChangeText={setConfirmPw}
                placeholder="Confirm new password" placeholderTextColor={C.textMuted}
                secureTextEntry autoCapitalize="none"
              />
              <Text style={st.helper}>Your current password is required. Leave blank to keep it.</Text>

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
  sectionHead: {
    fontSize: fs(12), fontWeight: '800', color: C.textMuted, letterSpacing: 0.6,
    textTransform: 'uppercase', marginTop: vs(18), paddingTop: vs(12),
    borderTopWidth: 0.5, borderTopColor: C.border,
  },
  sectionNote: { fontSize: fs(11), color: C.textMuted, marginTop: vs(2) },
  helper:      { fontSize: fs(11), color: C.textMuted, marginTop: vs(4) },
  charCount: { fontSize: fs(12), fontWeight: '600', color: C.textMuted, marginTop: vs(10) },
  input: {
    backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border, borderRadius: ms(12),
    paddingHorizontal: ms(12), paddingVertical: vs(9), fontSize: fs(14), color: C.textPrimary,
  },
  inputDisabled: { backgroundColor: C.border, justifyContent: 'center' },
  disabledText:  { fontSize: fs(14), color: C.textMuted },
  inputBio: { minHeight: vs(70) },
  // Phone: country box + national number, matching onboarding
  phoneRow: { flexDirection: 'row', gap: ms(8), alignItems: 'center' },
  countryBox: {
    flexDirection: 'row', alignItems: 'center', gap: ms(4),
    backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border,
    borderRadius: ms(12), paddingHorizontal: ms(10), paddingVertical: vs(9),
  },
  callingCode: { fontSize: fs(14), fontWeight: '600', color: C.textPrimary },
  phoneInput: {
    flex: 1, backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border,
    borderRadius: ms(12), paddingHorizontal: ms(12), paddingVertical: vs(9),
    fontSize: fs(14), color: C.textPrimary,
  },
  // Gender combo box
  pickerBox: {
    backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border,
    borderRadius: ms(12), overflow: 'hidden',
  },
  picker: { color: C.textPrimary },

  // Per-field visibility switch
  visToggle: {
    alignSelf: 'flex-start', marginTop: vs(6),
    paddingVertical: vs(5), paddingHorizontal: ms(10), borderRadius: ms(20), borderWidth: 1,
  },
  visTogglePublic:  { backgroundColor: C.accent, borderColor: C.accent },
  visTogglePrivate: { backgroundColor: 'transparent', borderColor: C.border },
  visText:        { fontSize: fs(11), fontWeight: '700' },
  visTextPublic:  { color: '#FFFFFF' },
  visTextPrivate: { color: C.textMuted },

  // Change-phone link + sub-form
  linkAction: { fontSize: fs(13), fontWeight: '700', color: C.accent, marginTop: vs(6) },
  subForm:    { marginTop: vs(6) },
  subFormRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: ms(14), marginTop: vs(10) },
  subFormCancel:  { fontSize: fs(13), fontWeight: '600', color: C.textMuted },
  subFormBtn:     { paddingVertical: vs(8), paddingHorizontal: ms(16), borderRadius: ms(12), backgroundColor: C.accent },
  subFormBtnText: { fontSize: fs(13), fontWeight: '700', color: '#FFFFFF' },

  // Password strength meter
  meterRow:   { flexDirection: 'row', alignItems: 'center', gap: ms(8), marginTop: vs(8) },
  meterTrack: { flex: 1, flexDirection: 'row', gap: ms(4) },
  meterSeg:   { flex: 1, height: vs(5), borderRadius: ms(3), backgroundColor: C.border },
  meterLabel: { fontSize: fs(11), fontWeight: '700', minWidth: ms(56), textAlign: 'right' },
  error: { fontSize: fs(13), fontWeight: '600', color: C.nahText, marginTop: vs(10), textAlign: 'center' },
  saveBtn: { marginTop: vs(16), paddingVertical: vs(12), borderRadius: ms(14), backgroundColor: C.accent, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { fontSize: fs(15), fontWeight: '700', color: '#FFFFFF' },
});
