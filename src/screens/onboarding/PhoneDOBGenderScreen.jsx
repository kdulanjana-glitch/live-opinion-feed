// ─────────────────────────────────────────────
// Peolia — Onboarding / PhoneDOBGenderScreen (Step 2 of 3)
// src/screens/onboarding/PhoneDOBGenderScreen.jsx
//
// Country-code + phone, date of birth (day/month/year), gender. Private info.
//
// Props: onDone: () => void, userId: string
// ─────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { PeoliaFonts as F , getPeoliaColors } from '../../constants/peoliaTheme';
import { usePeoliaScheme } from '../../context/ThemeContext';
import { Picker } from '@react-native-picker/picker';
import CountryPicker from 'react-native-country-picker-modal';
import { supabase } from '../../lib/supabase';

import { fs, ms, vs, s } from '../../utils/peoliaScale';

const MONTHS = [
  { label: 'Jan', value: '01' }, { label: 'Feb', value: '02' }, { label: 'Mar', value: '03' },
  { label: 'Apr', value: '04' }, { label: 'May', value: '05' }, { label: 'Jun', value: '06' },
  { label: 'Jul', value: '07' }, { label: 'Aug', value: '08' }, { label: 'Sep', value: '09' },
  { label: 'Oct', value: '10' }, { label: 'Nov', value: '11' }, { label: 'Dec', value: '12' },
];
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 85 }, (_, i) => String(CURRENT_YEAR - 16 - i)); // newest first, 16→100

const GENDERS = [
  { label: 'Male',              value: 'male' },
  { label: 'Female',            value: 'female' },
  { label: 'Prefer not to say', value: 'prefer_not_to_say' },
];

export default function PhoneDOBGenderScreen({ onDone, userId }) {
  const scheme = usePeoliaScheme();
  const C = getPeoliaColors(scheme);
  const st = makeStyles(C);

  const [countryCode,   setCountryCode]   = useState('AE');
  const [callingCode,   setCallingCode]   = useState('971');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [phone,         setPhone]         = useState('');
  const [day,           setDay]           = useState('');
  const [month,         setMonth]         = useState('');
  const [year,          setYear]          = useState('');
  const [gender,        setGender]        = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [isPhoneAccount, setIsPhoneAccount] = useState(false);
  const [phoneTaken,    setPhoneTaken]    = useState(false);
  const [saving,        setSaving]        = useState(false);

  // Phone accounts log in with a synthetic email, so offer a real recovery
  // email here. Email accounts already have a real login email — skip it.
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setIsPhoneAccount(!!data?.user?.email?.endsWith('@phone.peolia.invalid'));
    });
    return () => { active = false; };
  }, []);

  const phoneDigits = phone.replace(/\D/g, '');
  // Phone is optional: phone accounts already gave it at signup; email accounts
  // may add one but don't have to. Only DOB + gender are required.
  const canContinue = !!day && !!month && !!year && !!gender && !saving;

  const handleContinue = () => {
    if (!canContinue) return;

    // Age check
    const dob = new Date(Number(year), Number(month) - 1, Number(day));
    const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    if (age < 16)  { Alert.alert('Too young', 'You must be at least 16 years old.'); return; }
    if (age > 100) { Alert.alert('Invalid date', 'Please enter a valid date of birth.'); return; }

    // Date of birth is permanent — confirm before saving.
    Alert.alert(
      'Confirm your date of birth',
      "Your date of birth can't be changed later. Is it correct?",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: saveDetails },
      ]
    );
  };

  const saveDetails = async () => {
    const fullPhone = '+' + callingCode + phoneDigits;
    const recovery = recoveryEmail.trim().toLowerCase();
    if (isPhoneAccount && recovery && !/^\S+@\S+\.\S+$/.test(recovery)) {
      Alert.alert('Invalid email', 'That recovery email does not look valid.'); return;
    }
    setSaving(true);
    setPhoneTaken(false);
    try {
      // Use the live auth id so the row satisfies user_private's own-row RLS.
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id ?? userId;

      // Private by default → user_private. Phone uniqueness is enforced by the
      // partial unique index (user_private_phone_unique); a clash surfaces as 23505.
      const row = {
        user_id:  uid,
        birthday: `${year}-${month}-${day}`,
        gender,
      };
      // Phone accounts already have their number stored from signup — leave it
      // untouched (omitted columns aren't overwritten on upsert). Email accounts
      // may optionally set a phone here, and only they get the recovery email.
      if (isPhoneAccount) {
        if (recovery) row.recovery_email = recovery;
      } else if (phoneDigits.length > 0) {
        row.phone = fullPhone;
      }
      const { error } = await supabase
        .from('user_private')
        .upsert(row, { onConflict: 'user_id' });
      if (error) {
        if (error.code === '23505') { setPhoneTaken(true); return; }
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
    <KeyboardAvoidingView style={st.screen} behavior="height">
      <ScrollView
        contentContainerStyle={st.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={st.step}>Step 2 of 3</Text>
        <Text style={st.title}>A bit about you</Text>
        <Text style={st.subtitle}>Private by default — you choose what to share later.</Text>

        {/* Phone — only for email accounts; phone accounts gave it at signup */}
        {!isPhoneAccount && (
          <>
            <Text style={st.label}>Phone Number (optional)</Text>
            <View style={st.phoneRow}>
              <TouchableOpacity style={st.countryBox} onPress={() => setPickerVisible(true)} activeOpacity={0.7}>
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
                <Text style={st.callingCode}>+{callingCode}</Text>
              </TouchableOpacity>
              <TextInput
                style={st.phoneInput}
                value={phone}
                onChangeText={(t) => { setPhone(t); setPhoneTaken(false); }}
                placeholder="501234567"
                placeholderTextColor={C.textMuted}
                keyboardType="phone-pad"
              />
            </View>
            {phoneTaken && (
              <Text style={st.errorText}>This number is already registered to another account.</Text>
            )}
          </>
        )}

        {/* Recovery email — phone accounts only (their login email is synthetic) */}
        {isPhoneAccount && (
          <>
            <Text style={[st.label, st.labelSpaced]}>Recovery Email (optional)</Text>
            <Text style={st.helper}>Lets you sign in and recover your account by email.</Text>
            <TextInput
              style={st.recoveryInput}
              value={recoveryEmail}
              onChangeText={setRecoveryEmail}
              placeholder="you@example.com"
              placeholderTextColor={C.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </>
        )}

        {/* Date of birth */}
        <Text style={[st.label, st.labelSpaced]}>Date of Birth</Text>
        <Text style={st.helper}>You must be at least 16 years old.</Text>
        <View style={st.dobRow}>
          <View style={st.pickerBox}>
            <Picker selectedValue={day} onValueChange={setDay} style={st.picker} dropdownIconColor={C.textMuted}>
              <Picker.Item label="Day" value="" color={C.textMuted} />
              {DAYS.map((d) => <Picker.Item key={d} label={d} value={d} color={C.textPrimary} />)}
            </Picker>
          </View>
          <View style={st.pickerBox}>
            <Picker selectedValue={month} onValueChange={setMonth} style={st.picker} dropdownIconColor={C.textMuted}>
              <Picker.Item label="Month" value="" color={C.textMuted} />
              {MONTHS.map((m) => <Picker.Item key={m.value} label={m.label} value={m.value} color={C.textPrimary} />)}
            </Picker>
          </View>
          <View style={st.pickerBox}>
            <Picker selectedValue={year} onValueChange={setYear} style={st.picker} dropdownIconColor={C.textMuted}>
              <Picker.Item label="Year" value="" color={C.textMuted} />
              {YEARS.map((y) => <Picker.Item key={y} label={y} value={y} color={C.textPrimary} />)}
            </Picker>
          </View>
        </View>
        <Text style={st.permanentNote}>⚠️ Your date of birth is permanent — it can't be changed later.</Text>

        {/* Gender */}
        <Text style={[st.label, st.labelSpaced]}>Gender</Text>
        <View style={st.genderRow}>
          {GENDERS.map((g) => {
            const active = gender === g.value;
            return (
              <TouchableOpacity
                key={g.value}
                style={[st.genderPill, active ? st.genderPillActive : st.genderPillInactive]}
                onPress={() => setGender(g.value)}
                activeOpacity={0.8}
              >
                <Text style={[st.genderText, active ? st.genderTextActive : st.genderTextInactive]}>
                  {g.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

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
    </KeyboardAvoidingView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  screen:  { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: ms(24), paddingTop: vs(56), paddingBottom: vs(32) },
  step:     { fontFamily: F.regular, fontSize: fs(10), color: C.textMuted },
  title:    { letterSpacing: -0.2, fontSize: fs(22), fontFamily: F.extraBold, color: C.textPrimary, marginTop: vs(8) },
  subtitle: { fontFamily: F.regular, fontSize: fs(12), color: C.textSecondary, marginTop: vs(4) },
  label:       { fontSize: fs(10), fontFamily: F.bold, color: C.textSecondary, marginTop: vs(20), marginBottom: vs(6) },
  labelSpaced: { marginTop: vs(24) },
  helper:   { fontFamily: F.regular, fontSize: fs(9), color: C.textMuted, marginTop: vs(-2), marginBottom: vs(6) },
  permanentNote: { fontSize: fs(9), fontFamily: F.semiBold, color: C.nahChosen, marginTop: vs(6) },
  phoneRow: { flexDirection: 'row', gap: ms(8), alignItems: 'center' },
  countryBox: {
    flexDirection: 'row', alignItems: 'center', gap: ms(4),
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: s(10), paddingHorizontal: ms(10), paddingVertical: vs(9),
  },
  callingCode: { fontSize: fs(13), fontFamily: F.semiBold, color: C.textPrimary },
  phoneInput: {
    fontFamily: F.regular, flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: s(10), paddingHorizontal: ms(12), paddingVertical: vs(11),
    fontSize: fs(13), color: C.textPrimary,
  },
  recoveryInput: {
    fontFamily: F.regular, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: s(10), paddingHorizontal: ms(12), paddingVertical: vs(11),
    fontSize: fs(13), color: C.textPrimary,
  },
  errorText: { fontSize: fs(9), fontFamily: F.semiBold, color: C.nahChosen, marginTop: vs(5) },
  dobRow: { flexDirection: 'row', gap: ms(8) },
  pickerBox: {
    flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: s(10),
    backgroundColor: C.surface, overflow: 'hidden',
  },
  picker: { color: C.textPrimary },
  genderRow: { flexDirection: 'row', gap: ms(8) },
  genderPill: {
    flex: 1, paddingVertical: vs(10), paddingHorizontal: ms(12),
    borderRadius: s(20), alignItems: 'center',
  },
  genderPillActive:   { backgroundColor: C.accent },
  genderPillInactive: { backgroundColor: C.surfaceAlt, borderWidth: 0.5, borderColor: C.border },
  genderText:         { fontSize: fs(11), fontFamily: F.bold },
  genderTextActive:   { color: '#FFFFFF' },
  genderTextInactive: { color: C.textSecondary },
  continueBtn: {
    backgroundColor: C.accent, paddingVertical: vs(14), borderRadius: s(30),
    alignItems: 'center', marginTop: vs(28),
  },
  continueDisabled: { opacity: 0.5 },
  continueText: { letterSpacing: -0.2, fontSize: fs(13), fontFamily: F.extraBold, color: '#FFFFFF' },
});
