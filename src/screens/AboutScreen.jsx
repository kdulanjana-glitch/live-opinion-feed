// ─────────────────────────────────────────────
// Peolia — AboutScreen
// src/screens/AboutScreen.jsx
//
// Full-page "About" view of the current citizen. Reachable from the Profile
// ⋮ menu. Shows joined date, masked identifier (email or phone), account
// type, gender, and date of birth.
//
// Props: profile (the profile object from ProfileScreen), onBack
// ─────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  StatusBar,
  Image,
} from 'react-native';
import { usePeoliaScheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import Icon from '../components/Icon';
import { getPeoliaColors } from '../constants/peoliaTheme';
import { fs, ms, vs, s } from '../utils/peoliaScale';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PHONE_DOMAIN = '@phone.peolia.invalid';

const GENDER_LABELS = {
  male: 'Male', female: 'Female', other: 'Other', prefer_not_to_say: 'Prefer not to say',
};

function maskEmail(email) {
  if (!email) return null;
  if (email.endsWith(PHONE_DOMAIN)) return null;
  const [local, domain] = email.split('@');
  if (!domain) return null;
  return local.slice(0, 2) + '***@' + domain;
}

function maskPhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 5) return '***';
  return digits.slice(0, 3) + '***' + digits.slice(-2);
}

function formatDOB(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function formatJoined(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const initialsOf = (p) => {
  const ai = p?.avatar_initials;
  if (ai && ai !== '??') return ai.toUpperCase();
  return (p?.displayName?.[0] ?? p?.username?.[0] ?? '?').toUpperCase();
};

export default function AboutScreen({ profile, onBack }) {
  const scheme = usePeoliaScheme();
  const C  = getPeoliaColors(scheme);
  const st = makeStyles(C);
  const insets = useSafeAreaInsets();

  const [authEmail, setAuthEmail] = useState(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setAuthEmail(data?.user?.email ?? null);
    });
    return () => { active = false; };
  }, []);

  const isPhoneAccount = !!authEmail?.endsWith(PHONE_DOMAIN);
  const idRow = isPhoneAccount
    ? { label: 'Phone', icon: 'ti-phone', value: maskPhone(profile?.phone) ?? '—' }
    : { label: 'Email', icon: 'ti-mail',  value: maskEmail(authEmail) ?? '—' };

  const hasDisplay = !!(profile?.displayName && profile.displayName.trim());
  const genderText = profile?.gender ? (GENDER_LABELS[profile.gender] ?? profile.gender) : '—';

  const rows = [
    { key: 'joined', icon: 'ti-calendar', label: 'Joined', value: formatJoined(profile?.created_at) },
    { key: 'id',     icon: idRow.icon,    label: idRow.label, value: idRow.value },
    { key: 'account', icon: 'ti-star',    label: 'Account', pill: 'Citizen' },
    { key: 'gender', icon: 'ti-user',     label: 'Gender', value: genderText },
    { key: 'dob',    icon: 'ti-clock',    label: 'Date of birth', value: formatDOB(profile?.date_of_birth) },
  ];

  return (
    <View style={st.screen}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={C.bg} />

      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={onBack} style={st.backBtn} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="ti-chevron-left" size={fs(22)} color={C.textPrimary} />
          <Text style={st.headerTitle}>About</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: vs(24) + insets.bottom }}>
        {/* Avatar block */}
        <View style={st.avatarBlock}>
          <View style={st.avatar}>
            {profile?.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={st.avatarImg} resizeMode="cover" />
            ) : (
              <Text style={st.avatarText}>{initialsOf(profile)}</Text>
            )}
          </View>
          <View style={st.nameBlock}>
            <Text style={st.displayName}>
              {hasDisplay ? profile.displayName : `@${profile?.username ?? '—'}`}
            </Text>
            {hasDisplay && <Text style={st.username}>@{profile?.username ?? '—'}</Text>}
          </View>
        </View>

        <View style={st.divider} />

        {/* Info rows */}
        <View style={st.rows}>
          {rows.map((r, i) => (
            <View key={r.key} style={[st.infoRow, i === rows.length - 1 && st.infoRowLast]}>
              <View style={st.infoLeft}>
                <Icon name={r.icon} size={fs(16)} color={C.textMuted} />
                <Text style={st.infoLabel}>{r.label}</Text>
              </View>
              {r.pill ? (
                <View style={st.accountPill}>
                  <Text style={st.accountPillText}>{r.pill}</Text>
                </View>
              ) : (
                <Text style={st.infoValue}>{r.value}</Text>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  screen: {
    flex: 1, backgroundColor: C.bg,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: ms(14), paddingTop: vs(10), paddingBottom: vs(8),
  },
  backBtn:  { flexDirection: 'row', alignItems: 'center', gap: ms(4) },
  headerTitle: { fontSize: fs(18), fontWeight: '800', color: C.textPrimary },

  avatarBlock: { paddingHorizontal: ms(14), paddingTop: vs(8), paddingBottom: vs(14), alignItems: 'center' },
  avatar: {
    width: s(64), height: s(64), borderRadius: s(32), backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImg:  { width: '100%', height: '100%' },
  avatarText: { fontSize: fs(26), fontWeight: '800', color: '#FFFFFF' },
  nameBlock:  { alignItems: 'center', marginTop: vs(8) },
  displayName: { fontSize: fs(18), fontWeight: '800', color: C.textPrimary },
  username:    { fontSize: fs(13), color: C.textMuted, marginTop: vs(2) },

  divider: { height: 0.5, backgroundColor: C.border, marginHorizontal: ms(14) },

  rows: { paddingHorizontal: ms(14) },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: vs(10), borderBottomWidth: 0.5, borderBottomColor: C.border,
  },
  infoRowLast: { borderBottomWidth: 0 },
  infoLeft:  { flexDirection: 'row', alignItems: 'center', gap: ms(6) },
  infoLabel: { fontSize: fs(14), fontWeight: '600', color: C.textSecondary },
  infoValue: { fontSize: fs(14), fontWeight: '700', color: C.textPrimary },
  accountPill: {
    backgroundColor: C.accentLight, borderRadius: ms(10),
    paddingVertical: vs(3), paddingHorizontal: ms(10),
  },
  accountPillText: { fontSize: fs(13), fontWeight: '700', color: C.accentDark },
});
