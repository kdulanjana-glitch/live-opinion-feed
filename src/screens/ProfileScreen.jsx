// ─────────────────────────────────────────────
// Peolia — ProfileScreen
// Replaces: old ProfileScreen.jsx + UserProfileScreen.jsx
//
// Pass userId to show another citizen's profile.
// Leave userId null/undefined for own profile.
//
// DB mapping (existing schema):
//   users table: id, username  (no display_name/bio/avatar_initials yet)
//   opinions table: text, category → floated sentis grid
//   user_stats / user_wave_stats → not yet in DB, stubbed as empty
// ─────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, useColorScheme,
  ActivityIndicator, Dimensions, StatusBar, Platform,
} from 'react-native';
import Svg, { Polygon, Circle, Line, Text as SvgText } from 'react-native-svg';
import { supabase } from '../lib/supabase';
import { getPeoliaColors } from '../constants/peoliaTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP  = 3;
const GRID_COLS = 3;
const TILE_SIZE = (SCREEN_WIDTH - 28 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

const WAVE_EMOJIS = {
  'Tech': '💻', 'Love': '❤️', 'Money': '💰', 'Life': '🌱',
  'Society': '🌍', 'Politics': '🏛️', 'Food': '🍕', 'Health': '💪',
  'Sports': '⚽', 'Entertainment': '🎬', 'Science': '🔬',
  'Education': '📚', 'Environment': '🌿',
};

const WAVE_GRADIENTS = {
  'Tech': '#1E1B4B', 'Love': '#831843', 'Money': '#78350F',
  'Life': '#134E4A', 'Society': '#1F2937', 'Politics': '#7F1D1D',
  'Food': '#7C2D12', 'Health': '#064E3B', 'Sports': '#1E3A5F',
  'Entertainment': '#3B0764', 'Science': '#0C4A6E',
  'Education': '#1A2E05', 'Environment': '#064E3B',
};

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

const formatCount = (n) => {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

export default function ProfileScreen({ userId, onBack, onOpenSenti }) {
  const scheme       = useColorScheme();
  const C            = getPeoliaColors(scheme);
  const s            = makeStyles(C);
  const isOwnProfile = !userId;

  const [profile,   setProfile]   = useState(null);
  const [sentis,    setSentis]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [following, setFollowing] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      let targetId = userId;
      if (!targetId) {
        const { data: { user } } = await supabase.auth.getUser();
        targetId = user?.id;
      }
      if (!targetId) { setLoading(false); return; }

      // Fetch user row (existing schema: id, username)
      const { data: userData } = await supabase
        .from('users')
        .select('id, username')
        .eq('id', targetId)
        .single();

      // Count their opinions as "sentis_count"
      const { count: sentisCount } = await supabase
        .from('opinions')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', targetId)
        .eq('status', 'approved');

      // Count their votes as "reacts_count"
      const { count: reactsCount } = await supabase
        .from('votes')
        .select('user_id', { count: 'exact', head: true })
        .eq('user_id', targetId);

      // Fetch floated opinions
      const { data: opinionData } = await supabase
        .from('opinions')
        .select('id, text, category')
        .eq('created_by', targetId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      setProfile({
        username: userData?.username ?? 'unknown',
        stats: {
          sentis_count:    sentisCount ?? 0,
          reacts_count:    reactsCount ?? 0,
          followers_count: 0,   // follows table not yet in DB
          following_count: 0,
        },
        dna: [],  // user_wave_stats not yet in DB — hides DNA chart
      });

      setSentis((opinionData ?? []).map((op) => ({
        id:       op.id,
        question: op.text,
        wave:     capitalize(op.category),
      })));

    } catch (err) {
      console.error('ProfileScreen fetchProfile error', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleFollow = () => setFollowing((f) => !f); // optimistic stub

  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  const stats = profile?.stats ?? {};

  return (
    <View style={s.screen}>
      <StatusBar
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={C.bg}
      />

      {/* Header */}
      <View style={s.header}>
        {!isOwnProfile ? (
          <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
            <Text style={s.backIcon}>←</Text>
            <Text style={s.headerTitle}>Citizen</Text>
          </TouchableOpacity>
        ) : (
          <Text style={s.headerTitle}>Profile</Text>
        )}
        {isOwnProfile && <Text style={s.settingsIcon}>⚙️</Text>}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Avatar + name + action */}
        <View style={s.avatarRow}>
          <View style={[s.avatar, { backgroundColor: isOwnProfile ? C.accent : '#059669' }]}>
            <Text style={s.avatarText}>
              {(profile?.username ?? '?')[0].toUpperCase()}
            </Text>
          </View>
          <View style={s.nameBlock}>
            <Text style={s.displayName}>{profile?.username ?? '—'}</Text>
            <Text style={s.username}>@{profile?.username ?? '—'}</Text>
          </View>
          <View style={s.actionButtons}>
            {isOwnProfile ? (
              <TouchableOpacity style={s.editBtn} activeOpacity={0.7}>
                <Text style={s.editText}>Edit</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={[s.followBtn, following && s.followingBtn]}
                  onPress={handleFollow}
                  activeOpacity={0.7}
                >
                  <Text style={[s.followText, following && s.followingText]}>
                    {following ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.askBtn} activeOpacity={0.7}>
                  <Text style={s.askText}>Ask</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Stats row */}
        <View style={s.statsRow}>
          {[
            { label: 'Sentis',    value: formatCount(stats.sentis_count)    },
            { label: 'Reacts',    value: formatCount(stats.reacts_count)    },
            { label: 'Followers', value: formatCount(stats.followers_count) },
            { label: 'Following', value: formatCount(stats.following_count) },
          ].map(({ label, value }, i, arr) => (
            <React.Fragment key={label}>
              <View style={s.statItem}>
                <Text style={s.statValue}>{value}</Text>
                <Text style={s.statLabel}>{label}</Text>
              </View>
              {i < arr.length - 1 && <View style={s.statDivider} />}
            </React.Fragment>
          ))}
        </View>

        {/* Citizen DNA — hidden until user_wave_stats table is added */}
        {profile?.dna?.length > 0 && (
          <View style={s.dnaSection}>
            <View style={s.dnaSectionHeader}>
              <Text style={s.dnaSectionTitle}>Citizen DNA</Text>
              <View style={s.dnaPrivacyRow}>
                <Text style={s.dnaPrivacyIcon}>{isOwnProfile ? '🔒' : '🌍'}</Text>
                <Text style={s.dnaPrivacyText}>{isOwnProfile ? 'Only you' : 'Public'}</Text>
              </View>
            </View>
            <View style={[s.dnaChart, { backgroundColor: C.surface, borderColor: C.border }]}>
              <CitizenDNAChart
                data={profile.dna}
                color={isOwnProfile ? C.accent : '#059669'}
                gridColor={C.border}
              />
            </View>
          </View>
        )}

        {/* Floated sentis grid */}
        <View style={s.gridSection}>
          <View style={s.gridHeader}>
            <Text style={s.gridTitle}>Floated sentis</Text>
            <Text style={s.gridCount}>{sentis.length} total</Text>
          </View>
          {sentis.length === 0 ? (
            <Text style={[s.gridEmpty, { color: C.textMuted }]}>No sentis floated yet.</Text>
          ) : (
            <View style={s.grid}>
              {sentis.map((item) => {
                const bg = WAVE_GRADIENTS[item.wave] ?? '#1E1B4B';
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[s.tile, { backgroundColor: bg, width: TILE_SIZE, height: TILE_SIZE }]}
                    onPress={() => onOpenSenti?.(item.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={s.tileText} numberOfLines={3}>{item.question}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

      </ScrollView>
    </View>
  );
}

// ── Citizen DNA Radar Chart ───────────────────
function CitizenDNAChart({ data, color, gridColor }) {
  if (!data.length) return null;

  const SIZE   = 200;
  const CX     = 100;
  const CY     = 80;
  const RADIUS = 60;
  const N      = Math.min(data.length, 6);
  const maxVal = Math.max(...data.map((d) => d.react_count), 1);

  const getPoint = (i, r) => {
    const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
    return { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) };
  };

  const rings      = [RADIUS, RADIUS * 0.66, RADIUS * 0.33];
  const dataPoints = data.slice(0, N).map((d, i) =>
    getPoint(i, (d.react_count / maxVal) * RADIUS)
  );
  const dataPolyPoints = dataPoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <Svg width="100%" height={SIZE * 0.75} viewBox={`0 0 ${SIZE} ${SIZE * 0.75}`}>
      {rings.map((r, ri) => (
        <Polygon
          key={ri}
          points={Array.from({ length: N }, (_, i) => {
            const p = getPoint(i, r);
            return `${p.x},${p.y}`;
          }).join(' ')}
          fill="none" stroke={gridColor} strokeWidth="0.8"
        />
      ))}
      {Array.from({ length: N }, (_, i) => {
        const outer = getPoint(i, RADIUS);
        return <Line key={i} x1={CX} y1={CY} x2={outer.x} y2={outer.y} stroke={gridColor} strokeWidth="0.5" />;
      })}
      <Polygon points={dataPolyPoints} fill={`${color}30`} stroke={color} strokeWidth="1.5" />
      {dataPoints.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r="2.5" fill={color} />)}
      {data.slice(0, N).map((d, i) => {
        const lp    = getPoint(i, RADIUS + 12);
        const emoji = WAVE_EMOJIS[d.wave] ?? '🌊';
        return (
          <SvgText key={i} x={lp.x} y={lp.y} textAnchor="middle" fontSize="6.5" fill="#6B7280" fontWeight="600">
            {emoji} {d.wave}
          </SvgText>
        );
      })}
    </Svg>
  );
}

const makeStyles = (C) => StyleSheet.create({
  screen: {
    flex: 1, backgroundColor: C.bg,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0,
  },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 0,
  },
  backBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backIcon:    { fontSize: 16, color: C.textPrimary },
  headerTitle: { fontSize: 13, fontWeight: '800', color: C.textPrimary },
  settingsIcon: { fontSize: 17 },
  avatarRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingTop: 10, gap: 10,
  },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  nameBlock:  { flex: 1 },
  displayName: { fontSize: 13, fontWeight: '800', color: C.textPrimary },
  username:    { fontSize: 9.5, fontWeight: '500', color: C.textMuted },
  actionButtons: { flexDirection: 'column', gap: 4, alignItems: 'flex-end', flexShrink: 0 },
  editBtn: {
    paddingVertical: 4, paddingHorizontal: 12, borderRadius: 20,
    backgroundColor: C.surfaceAlt, borderWidth: 0.5, borderColor: C.border,
  },
  editText:    { fontSize: 8.5, fontWeight: '700', color: C.textSecondary },
  followBtn:   { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 20, backgroundColor: C.accent },
  followingBtn: { backgroundColor: C.surfaceAlt, borderWidth: 0.5, borderColor: C.border },
  followText:   { fontSize: 8.5, fontWeight: '700', color: '#FFFFFF' },
  followingText: { color: C.textSecondary },
  askBtn: {
    paddingVertical: 3, paddingHorizontal: 10, borderRadius: 20,
    backgroundColor: C.surfaceAlt, borderWidth: 0.5, borderColor: C.border,
  },
  askText: { fontSize: 8.5, fontWeight: '700', color: C.textSecondary },
  statsRow: { flexDirection: 'row', paddingHorizontal: 14, paddingTop: 10 },
  statItem:   { flex: 1, alignItems: 'center', gap: 1 },
  statValue:  { fontSize: 13, fontWeight: '800', color: C.textPrimary },
  statLabel:  { fontSize: 7, fontWeight: '600', color: C.textMuted },
  statDivider: { width: 0.5, backgroundColor: C.border, marginHorizontal: 4 },
  dnaSection:  { paddingHorizontal: 14, paddingTop: 10 },
  dnaSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  dnaSectionTitle:  { fontSize: 10, fontWeight: '700', color: C.textPrimary },
  dnaPrivacyRow:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dnaPrivacyIcon:   { fontSize: 9 },
  dnaPrivacyText:   { fontSize: 7.5, fontWeight: '600', color: C.textMuted },
  dnaChart:         { borderRadius: 12, padding: 6, borderWidth: 0.5 },
  gridSection: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 20 },
  gridHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  gridTitle:   { fontSize: 10, fontWeight: '700', color: C.textPrimary },
  gridCount:   { fontSize: 8, fontWeight: '600', color: C.textMuted },
  gridEmpty:   { fontSize: 12, textAlign: 'center', paddingVertical: 24 },
  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  tile:        { borderRadius: 8, padding: 4, justifyContent: 'flex-end' },
  tileText:    { fontSize: 6, fontWeight: '700', color: 'rgba(255,255,255,0.85)', lineHeight: 8 },
});
