// ─────────────────────────────────────────────
// Peolia — SettingsScreen
// src/screens/SettingsScreen.jsx
//
// Reached from the Profile ⋮ menu. Three tabs:
//   General  — appearance (theme), haptics, notification prefs
//   Profile  — the full profile editor (EditProfileSheet, bare mode) + DNA visibility
//   Security — change password / email-phone (jump to Profile), biometric app lock,
//              log out everywhere, danger zone (delete account)
//
// Props: onBack, session?, profile?, onSaved?   (uid resolved internally so this
// works whether opened from index or from ProfileScreen's sub-screen path)
// ─────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Modal,
  TextInput,
  Alert,
  StatusBar,
  Platform,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { PeoliaFonts as F , getPeoliaColors } from '../constants/peoliaTheme';
import { usePeoliaScheme, useThemePref } from '../context/ThemeContext';
import { useWavePrefs, ALL_WAVES, DEFAULT_PREF } from '../context/WavePrefsContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import Icon from '../components/Icon';
import EditProfileSheet from '../components/EditProfileSheet';

import { fs, ms, vs, s } from '../utils/peoliaScale';

// Optional native modules — absent in Expo Go / older dev builds. Guard the
// requires so Settings still loads; the haptic preview and biometric lock just
// become no-ops / unavailable until a build that includes them is installed.
let Haptics = null;
try { Haptics = require('expo-haptics'); } catch {}
let LocalAuthentication = null;
try { LocalAuthentication = require('expo-local-authentication'); } catch {}

// Documented hardcoded-color exception: danger red for the Danger Zone + delete.
const DANGER       = '#DC2626';
const DANGER_LIGHT = '#F87171';
const DANGER_BG    = 'rgba(220,38,38,0.08)';

const HAPTICS_KEY  = 'peolia_haptics';
const APP_LOCK_KEY = 'peolia_app_lock';

const NOTIF_DEFAULTS = {
  notify_react:  true,
  notify_voice:  true,
  notify_reply:  true,
  notify_follow: true,
};

const TABS = [
  { key: 'general',     label: 'General'     },
  { key: 'profile',     label: 'Profile'     },
  { key: 'security',    label: 'Security'    },
  { key: 'personalize', label: 'Personalize' },
];

// ALL_WAVES + DEFAULT_PREF are imported from WavePrefsContext (shared source).
const WAVE_EMOJIS = {
  'Tech': '💻', 'Love': '❤️', 'Money': '💰', 'Life': '🌱',
  'Society': '🌍', 'Politics': '🏛️', 'Food': '🍕', 'Health': '💪',
  'Sports': '⚽', 'Entertainment': '🎬', 'Science': '🔬',
  'Education': '📚', 'Environment': '🌿',
};

const LEVELS = ['low', 'mid', 'high'];

export default function SettingsScreen({ onBack, session, profile, onSaved }) {
  const scheme = usePeoliaScheme();
  const C = getPeoliaColors(scheme);
  const st = makeStyles(C);
  const insets = useSafeAreaInsets();
  const { themePref, setThemePref } = useThemePref();

  const [uid, setUid] = useState(session?.user?.id ?? null);
  const [activeTab, setActiveTab] = useState('general');

  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState(NOTIF_DEFAULTS);

  // Personalize tab — per-wave preferences come from the shared context (so
  // changes propagate live to the feed + Profile DNA). DNA visibility is a
  // users column, kept local here.
  const { wavePrefs, setWavePref } = useWavePrefs();
  const [dnaPublic, setDnaPublic] = useState(false);
  const [leaderboardPublic, setLeaderboardPublic] = useState(false);

  // Profile-tab seed for EditProfileSheet — always fetched from the DB below so we
  // don't depend on the caller's profile-object shape.
  const [profileInitial, setProfileInitial] = useState(null);

  // Delete-account sheet
  const [deleteSheetVisible, setDeleteSheetVisible] = useState(false);
  const [deleteConfirmText,  setDeleteConfirmText]  = useState('');
  const [deletePassword,     setDeletePassword]     = useState('');
  const [deleting,           setDeleting]           = useState(false);

  // Keyboard lift for the delete sheet (RN Modal doesn't resize on Android).
  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKbHeight(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // ── Resolve uid (works whether or not a session was passed) ──
  useEffect(() => {
    if (uid) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUid(user?.id ?? null);
    })();
  }, [uid]);

  // ── Load local prefs ──
  useEffect(() => {
    (async () => {
      try {
        const [h, l] = await Promise.all([
          AsyncStorage.getItem(HAPTICS_KEY),
          AsyncStorage.getItem(APP_LOCK_KEY),
        ]);
        if (h !== null) setHapticsEnabled(h === 'true');
        if (l !== null) setAppLockEnabled(l === 'true');
      } catch {
        // keep defaults
      }
    })();
  }, []);

  // ── Load notification prefs + profile seed (once uid is known) ──
  useEffect(() => {
    if (!uid) return;
    (async () => {
      // Notification prefs — missing row OR missing table both fall back to all-true.
      try {
        const { data } = await supabase
          .from('notification_prefs')
          .select('notify_react, notify_voice, notify_reply, notify_follow')
          .eq('user_id', uid)
          .maybeSingle();
        if (data) {
          setNotifPrefs({
            notify_react:  data.notify_react  ?? true,
            notify_voice:  data.notify_voice  ?? true,
            notify_reply:  data.notify_reply  ?? true,
            notify_follow: data.notify_follow ?? true,
          });
        }
      } catch {
        // table not present yet — keep defaults
      }

      // Profile seed — authoritative columns straight from the users row.
      const { data: u } = await supabase
        .from('users')
        .select('username, display_name, bio, avatar_url, dna_public, leaderboard_public')
        .eq('id', uid)
        .single();
      if (u) {
        setProfileInitial({
          username:    u.username ?? '',
          displayName: u.display_name ?? '',
          bio:         u.bio ?? '',
          avatarUrl:   u.avatar_url ?? null,
          dnaPublic:   !!u.dna_public,
        });
        setDnaPublic(!!u.dna_public);
        setLeaderboardPublic(!!u.leaderboard_public);
      }
    })();
  }, [uid]);

  // ── General: haptics ──
  const toggleHaptics = (next) => {
    setHapticsEnabled(next);
    AsyncStorage.setItem(HAPTICS_KEY, JSON.stringify(next)).catch(() => {});
    if (next && Haptics) {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    }
  };

  // ── General: notification prefs (optimistic + rollback) ──
  const toggleNotif = async (key, nextValue) => {
    const prev = notifPrefs;
    const next = { ...notifPrefs, [key]: nextValue };
    setNotifPrefs(next);
    const { error } = await supabase
      .from('notification_prefs')
      .upsert(
        { user_id: uid, ...next, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    if (error) {
      setNotifPrefs(prev);
      Alert.alert('Could not save', error.message ?? 'Please try again.');
    }
  };

  // ── Personalize: per-wave preference — context handles optimistic + rollback ──
  // Changes apply live (feed re-shapes, Profile DNA re-filters via the context).
  const saveWavePref = async (wave, changes) => {
    const ok = await setWavePref(wave, changes);
    if (!ok) Alert.alert('Could not save', 'Please try again.');
  };

  // ── Personalize: DNA visibility (users.dna_public) — optimistic + rollback ──
  const saveDnaPublic = async (next) => {
    const prev = dnaPublic;
    setDnaPublic(next);
    const { error } = await supabase
      .from('users')
      .update({ dna_public: next })
      .eq('id', uid);
    if (error) {
      setDnaPublic(prev);
      Alert.alert('Could not save', error.message ?? 'Please try again.');
    }
  };

  // ── Personalize: leaderboard visibility (users.leaderboard_public) — optimistic + rollback ──
  const saveLeaderboardPublic = async (next) => {
    const prev = leaderboardPublic;
    setLeaderboardPublic(next);
    const { error } = await supabase
      .from('users')
      .update({ leaderboard_public: next })
      .eq('id', uid);
    if (error) {
      setLeaderboardPublic(prev);
      Alert.alert('Could not save', error.message ?? 'Please try again.');
    }
  };

  // ── Security: biometric app lock ──
  const toggleAppLock = async (next) => {
    if (!LocalAuthentication) {
      Alert.alert(
        'Not available',
        'App lock needs a new build of the app that includes biometric support.'
      );
      return;
    }
    if (next) {
      const [hasHardware, isEnrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      if (!hasHardware || !isEnrolled) {
        Alert.alert(
          'Not available',
          'Set up fingerprint or face unlock in your device settings first.'
        );
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirm to enable app lock',
      });
      if (result.success) {
        setAppLockEnabled(true);
        AsyncStorage.setItem(APP_LOCK_KEY, 'true').catch(() => {});
      }
      // else: leave OFF
    } else {
      setAppLockEnabled(false);
      AsyncStorage.setItem(APP_LOCK_KEY, 'false').catch(() => {});
    }
  };

  // ── Security: log out everywhere ──
  const logOutEverywhere = () => {
    Alert.alert(
      'Log out everywhere?',
      'This will end your session on all devices, including this one.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: async () => { await supabase.auth.signOut({ scope: 'global' }); },
        },
      ]
    );
  };

  // ── Danger zone: delete account ──
  const deleteReady = deleteConfirmText.trim().toUpperCase() === 'DELETE' && deletePassword.length > 0;

  const closeDeleteSheet = () => {
    setDeleteSheetVisible(false);
    setDeleteConfirmText('');
    setDeletePassword('');
  };

  const handleDeleteAccount = async () => {
    if (!deleteReady || deleting) return;
    setDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // Step 1 — re-authenticate to confirm the password (works for real + synthetic phone email)
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: deletePassword,
      });
      if (authError) {
        Alert.alert('Incorrect password', 'Please try again.');
        setDeleting(false);
        return;
      }
      // Step 2 — schedule deletion server-side
      const { error: fnError } = await supabase.functions.invoke('delete-account');
      if (fnError) throw fnError;
      // Step 3 — sign out (index.tsx onAuthStateChange lands us back on the auth screen)
      await supabase.auth.signOut();
      Alert.alert('Account deleted', 'Your account has been scheduled for deletion.');
    } catch (err) {
      console.error('handleDeleteAccount error', err);
      Alert.alert('Something went wrong', 'Please try again or contact support.');
    } finally {
      setDeleting(false);
      closeDeleteSheet();
    }
  };

  // ── Small render helpers ──
  const Section = ({ title, children, danger }) => (
    <View style={[st.card, danger && st.dangerCard]}>
      {title && <Text style={[st.sectionTitle, danger && st.dangerTitle]}>{title}</Text>}
      {children}
    </View>
  );

  const ToggleRow = ({ label, value, onValueChange }) => (
    <View style={st.row}>
      <Text style={st.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: C.surfaceAlt, true: C.accent }}
        thumbColor="#FFFFFF"
      />
    </View>
  );

  const NavRow = ({ icon, label, onPress, danger }) => (
    <TouchableOpacity style={st.row} onPress={onPress} activeOpacity={0.7}>
      <View style={st.rowLeft}>
        {icon && <Icon name={icon} size={fs(18)} color={danger ? DANGER : C.textSecondary} />}
        <Text style={[st.rowLabel, danger && { color: DANGER }]}>{label}</Text>
      </View>
      {!danger && <Icon name="ti-chevron-right" size={fs(18)} color={C.textMuted} />}
    </TouchableOpacity>
  );

  // ── Tab bodies ──
  const renderGeneral = () => (
    <>
      <Section title="APPEARANCE">
        {[
          { key: 'dark',   label: 'Dark',           icon: 'ti-moon' },
          { key: 'light',  label: 'Light',          icon: 'ti-sun' },
          { key: 'system', label: 'System default', icon: 'ti-device-mobile' },
        ].map((opt) => {
          const active = themePref === opt.key;
          return (
            <TouchableOpacity key={opt.key} style={st.row} onPress={() => setThemePref(opt.key)} activeOpacity={0.7}>
              <View style={st.rowLeft}>
                <Icon name={opt.icon} size={fs(18)} color={C.textSecondary} />
                <Text style={st.rowLabel}>{opt.label}</Text>
              </View>
              {active && <Icon name="ti-check" size={fs(18)} color={C.accent} />}
            </TouchableOpacity>
          );
        })}
      </Section>

      <Section title="FEEDBACK">
        <ToggleRow label="Haptics" value={hapticsEnabled} onValueChange={toggleHaptics} />
      </Section>

      <Section title="NOTIFICATIONS">
        <ToggleRow label="Reacts on my sentis" value={notifPrefs.notify_react}  onValueChange={(v) => toggleNotif('notify_react', v)} />
        <ToggleRow label="New voices"          value={notifPrefs.notify_voice}  onValueChange={(v) => toggleNotif('notify_voice', v)} />
        <ToggleRow label="Replies to me"       value={notifPrefs.notify_reply}  onValueChange={(v) => toggleNotif('notify_reply', v)} />
        <ToggleRow label="New followers"       value={notifPrefs.notify_follow} onValueChange={(v) => toggleNotif('notify_follow', v)} />
      </Section>
    </>
  );

  const renderSecurity = () => (
    <>
      <Section title="ACCOUNT ACCESS">
        <NavRow icon="ti-key" label="Change password"     onPress={() => setActiveTab('profile')} />
        <View style={st.divider} />
        <NavRow icon="ti-at"  label="Change email / phone" onPress={() => setActiveTab('profile')} />
      </Section>

      <Section title="APP SECURITY">
        <ToggleRow label="App lock (biometric)" value={appLockEnabled} onValueChange={toggleAppLock} />
      </Section>

      <Section title="SESSIONS">
        <NavRow icon="ti-logout" label="Log out of all devices" onPress={logOutEverywhere} />
      </Section>

      <Section title="DANGER ZONE" danger>
        <NavRow icon="ti-trash" label="Delete account" danger onPress={() => setDeleteSheetVisible(true)} />
      </Section>
    </>
  );

  // Three-dot Low/Mid/High selector for one wave.
  const LevelSelector = ({ wave, level, disabled }) => (
    <View style={st.dotTrack}>
      {LEVELS.map((lvl) => {
        const selected = level === lvl;
        return (
          <TouchableOpacity
            key={lvl}
            disabled={disabled}
            onPress={() => saveWavePref(wave, { level: lvl })}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          >
            <View style={[st.dot, selected ? st.dotSelected : st.dotUnselected]} />
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderPersonalize = () => (
    <>
      <Section title="WAVE MIX">
        <Text style={st.subtitle}>Control how much of each wave appears in your Sentarium</Text>
        <View style={st.waveList}>
          {ALL_WAVES.map((wave, i) => {
            const pref     = wavePrefs[wave] ?? DEFAULT_PREF;
            const excluded = pref.excluded;
            return (
              <View key={wave}>
                <View style={st.waveRow}>
                  {/* Top line: emoji + name + on/off toggle */}
                  <View style={st.waveTopLine}>
                    <Text style={st.waveName} numberOfLines={1}>
                      {WAVE_EMOJIS[wave] ?? '🌊'}  {wave}
                    </Text>
                    <Switch
                      value={!excluded}
                      onValueChange={(on) => saveWavePref(wave, { excluded: !on })}
                      trackColor={{ false: C.surfaceAlt, true: C.accent }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                  {/* Bottom line: Low — selector — High (dimmed + locked when excluded) */}
                  <View style={[st.waveBottomLine, excluded && st.waveBottomLineOff]}>
                    <Text style={[st.lvlLabel, pref.level === 'low' ? st.lvlLabelOn : st.lvlLabelOff]}>Low</Text>
                    <LevelSelector wave={wave} level={pref.level} disabled={excluded} />
                    <Text style={[st.lvlLabel, pref.level === 'high' ? st.lvlLabelOn : st.lvlLabelOff]}>High</Text>
                  </View>
                </View>
                {i < ALL_WAVES.length - 1 && <View style={st.divider} />}
              </View>
            );
          })}
        </View>
      </Section>

      <Section title="CITIZEN DNA">
        <Text style={st.subtitle}>
          Based on your reacts and floats. Tap waves to show or hide them on your chart.
        </Text>
        <View style={st.chipFlow}>
          {ALL_WAVES.map((wave) => {
            const included = (wavePrefs[wave] ?? DEFAULT_PREF).dna_include;
            return (
              <TouchableOpacity
                key={wave}
                style={[st.dnaChip, included ? st.dnaChipOn : st.dnaChipOff]}
                onPress={() => saveWavePref(wave, { dna_include: !included })}
                activeOpacity={0.8}
              >
                <Text style={[st.dnaChipText, included ? st.dnaChipTextOn : st.dnaChipTextOff]}>
                  {WAVE_EMOJIS[wave] ?? '🌊'} {wave}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={st.dnaVisRow}>
          <Text style={st.dnaVisLabel}>DNA visible to</Text>
          <View style={st.segment}>
            {[
              { val: false, label: 'Only me'  },
              { val: true,  label: 'Everyone' },
            ].map((opt) => {
              const active = dnaPublic === opt.val;
              return (
                <TouchableOpacity
                  key={opt.label}
                  style={[st.segmentBtn, active && st.segmentBtnActive]}
                  onPress={() => saveDnaPublic(opt.val)}
                  activeOpacity={0.8}
                >
                  <Text style={[st.segmentText, active && st.segmentTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={st.dnaVisRow}>
          <Text style={st.dnaVisLabel}>Show me on leaderboards</Text>
          <View style={st.segment}>
            {[
              { val: false, label: 'Only me'  },
              { val: true,  label: 'Everyone' },
            ].map((opt) => {
              const active = leaderboardPublic === opt.val;
              return (
                <TouchableOpacity
                  key={opt.label}
                  style={[st.segmentBtn, active && st.segmentBtnActive]}
                  onPress={() => saveLeaderboardPublic(opt.val)}
                  activeOpacity={0.8}
                >
                  <Text style={[st.segmentText, active && st.segmentTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Section>
    </>
  );

  return (
    <View style={st.screen}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={C.bg} />

      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={onBack} style={st.backBtn} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="ti-chevron-left" size={fs(22)} color={C.textPrimary} />
          <Text style={st.headerTitle}>Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs — horizontal scroll so all four pills fit at any width */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={st.tabScroll}
        contentContainerStyle={st.tabRow}
      >
        {TABS.map((t) => {
          const active = activeTab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[st.tabPill, active ? st.tabPillActive : st.tabPillInactive]}
              onPress={() => setActiveTab(t.key)}
              activeOpacity={0.8}
            >
              <Text style={[st.tabText, active ? st.tabTextActive : st.tabTextInactive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Body */}
      {activeTab === 'profile' ? (
        // The profile editor manages its own scroll + save (incl. DNA visibility).
        profileInitial ? (
          <EditProfileSheet bare initial={profileInitial} onSaved={onSaved} />
        ) : (
          <View style={st.loader}><ActivityIndicator color={C.accent} /></View>
        )
      ) : (
        <ScrollView
          style={st.body}
          contentContainerStyle={{ paddingBottom: vs(24) + insets.bottom }}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'general'
            ? renderGeneral()
            : activeTab === 'personalize'
              ? renderPersonalize()
              : renderSecurity()}
        </ScrollView>
      )}

      {/* Delete-account confirmation sheet */}
      <Modal visible={deleteSheetVisible} transparent animationType="slide" statusBarTranslucent onRequestClose={closeDeleteSheet}>
        <View style={st.backdrop}>
          <View style={[
            st.sheet,
            { marginBottom: kbHeight, paddingBottom: kbHeight > 0 ? vs(10) : vs(20) + insets.bottom },
          ]}>
            <View style={st.handle} />
            <View style={st.warnIconWrap}>
              <Icon name="ti-alert-triangle" size={fs(34)} color={DANGER} />
            </View>
            <Text style={st.deleteTitle}>Delete your account?</Text>
            <Text style={st.deleteBody}>
              This is permanent after 30 days. Your sentis, voices, and reacts will be removed.
              This can't be undone.
            </Text>

            <Text style={st.deleteLabel}>TYPE "DELETE" TO CONFIRM</Text>
            <TextInput
              style={st.input}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder="DELETE"
              placeholderTextColor={C.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <Text style={st.deleteLabel}>PASSWORD</Text>
            <TextInput
              style={st.input}
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder="Your password"
              placeholderTextColor={C.textMuted}
              secureTextEntry
              autoCapitalize="none"
            />

            <View style={st.deleteBtnRow}>
              <TouchableOpacity style={[st.deleteBtn, st.cancelBtn]} onPress={closeDeleteSheet} activeOpacity={0.7}>
                <Text style={[st.deleteBtnText, { color: C.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.deleteBtn, st.confirmDeleteBtn, !deleteReady && st.deleteBtnDisabled]}
                onPress={handleDeleteAccount}
                disabled={!deleteReady || deleting}
                activeOpacity={0.8}
              >
                {deleting
                  ? <ActivityIndicator color="#FFFFFF" size="small" />
                  : <Text style={[st.deleteBtnText, { color: '#FFFFFF' }]}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0,
  },
  header: { paddingHorizontal: ms(12), paddingTop: vs(8), paddingBottom: vs(4) },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: ms(4) },
  headerTitle: { letterSpacing: -0.2, fontSize: fs(20), fontFamily: F.extraBold, color: C.textPrimary },

  // Tabs (same visual pattern as VoiceSheet New/Top) — horizontal scroll
  tabScroll: { flexGrow: 0 },
  tabRow: { flexDirection: 'row', gap: ms(8), paddingHorizontal: ms(16), paddingVertical: vs(10) },
  tabPill: { paddingVertical: vs(7), paddingHorizontal: ms(16), borderRadius: ms(20) },
  tabPillActive:   { backgroundColor: C.accent },
  tabPillInactive: { backgroundColor: C.surfaceAlt, borderWidth: 0.5, borderColor: C.border },
  tabText:         { fontSize: fs(13), fontFamily: F.bold },
  tabTextActive:   { color: '#FFFFFF' },
  tabTextInactive: { color: C.textMuted },

  body: { flex: 1, paddingHorizontal: ms(16) },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  card: {
    backgroundColor: C.surface,
    borderRadius: ms(14),
    borderWidth: 0.5,
    borderColor: C.border,
    paddingHorizontal: ms(14),
    paddingVertical: vs(4),
    marginTop: vs(12),
  },
  sectionTitle: {
    fontSize: fs(11), fontFamily: F.extraBold, letterSpacing: 0.6,
    color: C.textMuted, marginTop: vs(10), marginBottom: vs(4),
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: vs(12),
  },
  rowLeft:  { flexDirection: 'row', alignItems: 'center', gap: ms(12), flexShrink: 1 },
  rowLabel: { fontSize: fs(15), fontFamily: F.semiBold, color: C.textPrimary },
  divider:  { height: 0.5, backgroundColor: C.border },

  // Danger zone
  dangerCard: { backgroundColor: DANGER_BG, borderColor: DANGER_LIGHT },
  dangerTitle: { color: DANGER },

  // Delete sheet
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.sheetBg,
    borderTopLeftRadius: ms(20), borderTopRightRadius: ms(20),
    borderTopWidth: 0.5, borderColor: C.sheetBorder,
    paddingHorizontal: ms(18), paddingTop: vs(10),
  },
  handle: { width: ms(36), height: vs(4), borderRadius: ms(2), backgroundColor: C.border, alignSelf: 'center', marginBottom: vs(14) },
  warnIconWrap: { alignItems: 'center', marginBottom: vs(8) },
  deleteTitle: { letterSpacing: -0.2, fontSize: fs(18), fontFamily: F.extraBold, color: C.textPrimary, textAlign: 'center', marginBottom: vs(6) },
  deleteBody:  { fontFamily: F.regular, fontSize: fs(14), lineHeight: fs(21), color: C.textSecondary, textAlign: 'center', marginBottom: vs(14) },
  deleteLabel: { fontSize: fs(11), fontFamily: F.extraBold, letterSpacing: 0.6, color: C.textMuted, marginTop: vs(10), marginBottom: vs(5) },
  input: {
    fontFamily: F.regular, backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border,
    borderRadius: ms(12), paddingHorizontal: ms(12), paddingVertical: vs(9),
    fontSize: fs(14), color: C.textPrimary,
  },
  deleteBtnRow: { flexDirection: 'row', gap: ms(10), marginTop: vs(16) },
  deleteBtn: { flex: 1, paddingVertical: vs(13), borderRadius: ms(14), alignItems: 'center' },
  cancelBtn: { backgroundColor: C.cancelBg },
  confirmDeleteBtn: { backgroundColor: DANGER },
  deleteBtnDisabled: { opacity: 0.5 },
  deleteBtnText: { fontSize: fs(15), fontFamily: F.bold },

  // ── Personalize tab ──
  subtitle: { fontSize: fs(13), fontFamily: F.semiBold, color: C.textMuted, marginBottom: vs(10), lineHeight: fs(19) },

  // Wave Mix rows
  waveList: { paddingBottom: vs(4) },
  waveRow:  { paddingVertical: vs(11) },
  waveTopLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  waveName: { fontSize: fs(15), fontFamily: F.bold, color: C.textPrimary, flexShrink: 1 },
  waveBottomLine: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: ms(12), marginTop: vs(10),
  },
  waveBottomLineOff: { opacity: 0.4 },
  lvlLabel:    { fontSize: fs(12), fontFamily: F.semiBold },
  lvlLabelOn:  { color: C.accent },
  lvlLabelOff: { color: C.textMuted },

  // Three-dot Low/Mid/High selector
  dotTrack: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: ms(20),
    backgroundColor: C.surfaceAlt, borderWidth: 0.5, borderColor: C.border,
    borderRadius: ms(20), paddingVertical: vs(7), paddingHorizontal: ms(16),
  },
  dot: { width: s(14), height: s(14), borderRadius: s(7) },
  dotSelected: {
    backgroundColor: C.accent, borderWidth: 2, borderColor: C.accentText,
    shadowColor: C.accent, shadowOpacity: 0.6, shadowRadius: 4, shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  dotUnselected: { backgroundColor: C.surfaceAlt, borderWidth: 1.5, borderColor: C.border },

  // Citizen DNA chips
  chipFlow: { flexDirection: 'row', flexWrap: 'wrap', gap: ms(8), marginTop: vs(4) },
  dnaChip: { paddingVertical: vs(9), paddingHorizontal: ms(13), borderRadius: ms(20) },
  dnaChipOn:  { backgroundColor: C.accent },
  dnaChipOff: { backgroundColor: C.surfaceAlt, borderWidth: 0.5, borderColor: C.border },
  dnaChipText:    { fontFamily: F.regular, fontSize: fs(13) },
  dnaChipTextOn:  { color: '#FFFFFF', fontFamily: F.bold },
  dnaChipTextOff: { color: C.textMuted, fontFamily: F.semiBold },

  // DNA visibility segmented control
  dnaVisRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: vs(16), paddingVertical: vs(10),
  },
  dnaVisLabel: { fontSize: fs(15), fontFamily: F.semiBold, color: C.textPrimary, flexShrink: 1 },
  segment:    { flexDirection: 'row', gap: ms(8) },
  segmentBtn: {
    paddingVertical: vs(9), paddingHorizontal: ms(16), borderRadius: ms(12),
    borderWidth: 0.5, borderColor: C.border, backgroundColor: C.surfaceAlt,
  },
  segmentBtnActive: { backgroundColor: C.accent, borderColor: C.accent },
  segmentText:       { fontSize: fs(13), fontFamily: F.bold, color: C.textMuted },
  segmentTextActive: { color: '#FFFFFF' },
});
