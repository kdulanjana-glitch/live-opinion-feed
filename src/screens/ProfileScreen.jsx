// ─────────────────────────────────────────────
// Peolia — ProfileScreen
// src/screens/ProfileScreen.jsx
//
// Own profile: pass no userId prop
// Other citizen: pass userId prop
//
// Queries (new schema):
//   users           — id, username
//   user_stats      — sentis_count, reacts_count, followers_count, following_count
//   user_wave_stats — wave, react_count  (drives DNA chart)
//   sentis          — id, question, wave, status, user_id
// ─────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import EditProfileSheet from '../components/EditProfileSheet';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, useColorScheme,
  ActivityIndicator, Dimensions, StatusBar, Platform,
  RefreshControl, Image, Modal,
} from 'react-native';
import Svg, { Polygon, Circle, Line, Text as SvgText } from 'react-native-svg';
import { supabase } from '../lib/supabase';
import SentiTile from '../components/SentiTile';
import PersonTile from '../components/PersonTile';
import EmptyState from '../components/EmptyState';
import { GridSkeleton } from '../components/Skeletons';
import { getPeoliaColors } from '../constants/peoliaTheme';
import { fs, ms, vs, s, SCREEN_WIDTH } from '../utils/peoliaScale';

const GRID_GAP  = ms(8);
const GRID_COLS = 3;
// ms(16)*2 matches gridSection paddingHorizontal on both sides
const TILE_W = Math.floor((SCREEN_WIDTH - ms(16) * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS);

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

const formatCount = (n) => {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

export default function ProfileScreen({ userId, onBack, onOpenSenti, onOpenUser }) {
  const scheme       = useColorScheme();
  const C            = getPeoliaColors(scheme);
  const st           = makeStyles(C);
  const isOwnProfile = !userId;

  const [profile,    setProfile]    = useState(null);
  const [sentis,     setSentis]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [following,  setFollowing]  = useState(false);
  const [myId,       setMyId]       = useState(null);
  const [editVisible, setEditVisible] = useState(false);
  const [viewerOpen,  setViewerOpen]  = useState(false);   // full-screen avatar viewer

  // Tabbed content under the stats: 'sentis' | 'reacts' | 'followers' | 'following'
  const [tab,        setTab]        = useState('sentis');
  const [reacts,     setReacts]     = useState(null);      // null = not loaded yet
  const [followers,  setFollowers]  = useState(null);
  const [followingList, setFollowingList] = useState(null);
  const [tabBusy,    setTabBusy]    = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const me = user?.id ?? null;
      setMyId(me);

      const targetId = userId ?? me;
      if (!targetId) { setLoading(false); return; }

      // Initial follow state — only when viewing another citizen
      const followCheck = (userId && me && userId !== me)
        ? supabase.from('follows').select('follower_id')
            .eq('follower_id', me).eq('following_id', userId).maybeSingle()
        : Promise.resolve({ data: null });

      // Run all queries in parallel
      const [userRes, sentisRes, dnaRes, floatedRes, userStatsRes, followRes, followersRes, followingRes] = await Promise.all([
        // Basic user info
        supabase.from('users').select('id, username, display_name, bio, avatar_url').eq('id', targetId).single(),

        // Sentis count — derived directly from sentis table (always accurate)
        supabase
          .from('sentis')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', targetId)
          .eq('status', 'approved'),

        // Wave breakdown for DNA chart
        supabase
          .from('user_wave_stats')
          .select('wave, react_count')
          .eq('user_id', targetId)
          .order('react_count', { ascending: false })
          .limit(6),

        // Floated sentis grid
        supabase
          .from('sentis')
          .select('id, question, wave, image_url')
          .eq('user_id', targetId)
          .eq('status', 'approved')
          .order('created_at', { ascending: false }),

        // user_stats — for reacts_count (trigger-maintained)
        supabase
          .from('user_stats')
          .select('reacts_count, followers_count, following_count')
          .eq('user_id', targetId)
          .maybeSingle(),

        followCheck,

        // Follower / following counts — derived directly from follows (always accurate;
        // user_stats counts aren't maintained, so don't rely on them)
        supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', targetId),
        supabase.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', targetId),
      ]);

      setFollowing(!!followRes.data);

      const ustats = userStatsRes.data ?? {};

      // Reacts count — prefer user_stats trigger value, fall back to direct count
      let reactsCount = ustats.reacts_count;
      if (reactsCount === null || reactsCount === undefined) {
        const { count } = await supabase
          .from('senti_reactions')
          .select('user_id', { count: 'exact', head: true })
          .eq('user_id', targetId);
        reactsCount = count ?? 0;
      }

      setProfile({
        username:    userRes.data?.username ?? 'unknown',
        displayName: userRes.data?.display_name ?? '',
        bio:         userRes.data?.bio ?? '',
        avatarUrl:   userRes.data?.avatar_url ?? null,
        stats: {
          sentis_count:    sentisRes.count    ?? 0,  // always live from sentis table
          reacts_count:    reactsCount,
          followers_count: followersRes.count ?? 0,  // live from follows
          following_count: followingRes.count ?? 0,  // live from follows
        },
        dna: dnaRes.data ?? [],
      });

      setSentis((floatedRes.data ?? []).map((s) => ({
        id:       s.id,
        question: s.question,
        wave:     s.wave ?? 'Tech',
        imageUrl: s.image_url ?? null,
      })));

    } catch (err) {
      console.error('ProfileScreen fetchProfile error', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  // Reset the tab + cached lists whenever we switch to a different profile
  useEffect(() => {
    setTab('sentis');
    setReacts(null);
    setFollowers(null);
    setFollowingList(null);
  }, [userId]);

  const targetId = userId ?? myId;

  // ── Lazy-load tab content the first time each tab is opened ──
  const loadReacts = useCallback(async (uid) => {
    setTabBusy(true);
    const { data, error } = await supabase
      .from('senti_reactions')
      .select('reacted_at, sentis(id, question, wave, image_url)')
      .eq('user_id', uid)
      .order('reacted_at', { ascending: false })
      .limit(20);
    if (error) console.error('loadReacts error', error);
    setReacts(
      (data ?? [])
        .map((r) => r.sentis)
        .filter(Boolean)
        .map((s) => ({ id: s.id, question: s.question, wave: s.wave ?? 'Tech', imageUrl: s.image_url ?? null }))
    );
    setTabBusy(false);
  }, []);

  const loadPeople = useCallback(async (uid, direction) => {
    setTabBusy(true);
    // followers: rows where following_id = uid → their follower_id
    // following: rows where follower_id  = uid → their following_id
    const matchCol  = direction === 'followers' ? 'following_id' : 'follower_id';
    const pickCol   = direction === 'followers' ? 'follower_id'  : 'following_id';
    const { data: rows, error } = await supabase.from('follows').select(pickCol).eq(matchCol, uid);
    if (error) console.error('loadPeople error', error);
    const ids = (rows ?? []).map((r) => r[pickCol]);
    let people = [];
    if (ids.length) {
      const { data: users } = await supabase
        .from('users')
        .select('id, username, display_name, avatar_url')
        .in('id', ids);
      people = users ?? [];
    }
    if (direction === 'followers') setFollowers(people);
    else setFollowingList(people);
    setTabBusy(false);
  }, []);

  useEffect(() => {
    if (!targetId) return;
    if (tab === 'reacts'    && reacts === null)        loadReacts(targetId);
    if (tab === 'followers' && followers === null)     loadPeople(targetId, 'followers');
    if (tab === 'following' && followingList === null) loadPeople(targetId, 'following');
  }, [tab, targetId, reacts, followers, followingList, loadReacts, loadPeople]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setReacts(null);
    setFollowers(null);
    setFollowingList(null);
    await fetchProfile();
    setRefreshing(false);
  };

  // ── Follow / unfollow — optimistic with rollback ─
  const bumpFollowers = (delta) => setProfile((prev) => prev ? {
    ...prev,
    stats: { ...prev.stats, followers_count: Math.max(0, (prev.stats.followers_count ?? 0) + delta) },
  } : prev);

  const handleFollow = useCallback(async () => {
    if (!myId || !userId || myId === userId) return;
    const was   = following;
    const delta = was ? -1 : 1;
    setFollowing(!was);
    bumpFollowers(delta);

    let error;
    if (!was) {
      ({ error } = await supabase.from('follows')
        .insert({ follower_id: myId, following_id: userId }));
    } else {
      ({ error } = await supabase.from('follows')
        .delete().eq('follower_id', myId).eq('following_id', userId));
    }
    if (error) {
      console.error('handleFollow error', error);
      setFollowing(was);
      bumpFollowers(-delta);
    }
  }, [myId, userId, following]);

  if (loading) {
    return (
      <View style={st.screen}>
        <GridSkeleton columns={3} count={6} />
      </View>
    );
  }

  const stats = profile?.stats ?? {};

  return (
    <View style={st.screen}>
      <StatusBar
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={C.bg}
      />

      {/* Header */}
      <View style={st.header}>
        {!isOwnProfile ? (
          <TouchableOpacity onPress={onBack} style={st.backBtn} activeOpacity={0.7}>
            <Text style={st.backIcon}>←</Text>
            <Text style={st.headerTitle}>Citizen</Text>
          </TouchableOpacity>
        ) : (
          <Text style={st.headerTitle}>Profile</Text>
        )}
        {isOwnProfile && <Text style={st.settingsIcon}>⚙️</Text>}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.accent} />
        }
      >

        {/* Avatar + name + action */}
        <View style={st.avatarRow}>
          <TouchableOpacity
            style={[st.avatar, { backgroundColor: isOwnProfile ? C.accent : '#059669' }]}
            activeOpacity={profile?.avatarUrl ? 0.85 : 1}
            disabled={!profile?.avatarUrl}
            onPress={() => setViewerOpen(true)}
          >
            {profile?.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={st.avatarImg} resizeMode="cover" />
            ) : (
              <Text style={st.avatarText}>
                {(profile?.username || '?')[0].toUpperCase()}
              </Text>
            )}
          </TouchableOpacity>
          <View style={st.nameBlock}>
            <Text style={st.displayName}>{profile?.displayName || profile?.username || '—'}</Text>
            <Text style={st.username}>@{profile?.username ?? '—'}</Text>
          </View>
          <View style={st.actionButtons}>
            {(isOwnProfile || userId === myId) ? (
              <TouchableOpacity style={st.editBtn} onPress={() => setEditVisible(true)} activeOpacity={0.7}>
                <Text style={st.editText}>Edit</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={[st.followBtn, following && st.followingBtn]}
                  onPress={handleFollow}
                  activeOpacity={0.7}
                >
                  <Text style={[st.followText, following && st.followingText]}>
                    {following ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.askBtn} activeOpacity={0.7}>
                  <Text style={st.askText}>Ask</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Bio */}
        {!!profile?.bio && (
          <Text style={st.bioText}>{profile.bio}</Text>
        )}

        {/* Stats row — tappable tabs (Sentis / Reacts / Followers / Following) */}
        <View style={st.statsRow}>
          {[
            { key: 'sentis',    label: 'Sentis',    value: formatCount(stats.sentis_count)    },
            { key: 'reacts',    label: 'Reacts',    value: formatCount(stats.reacts_count)    },
            { key: 'followers', label: 'Followers', value: formatCount(stats.followers_count) },
            { key: 'following', label: 'Following', value: formatCount(stats.following_count) },
          ].map(({ key, label, value }, i, arr) => {
            const active = tab === key;
            return (
              <React.Fragment key={key}>
                <TouchableOpacity style={st.statItem} onPress={() => setTab(key)} activeOpacity={0.7}>
                  <Text style={[st.statValue, active && st.statValueActive]}>{value}</Text>
                  <Text style={[st.statLabel, active && st.statLabelActive]}>{label}</Text>
                  <View style={[st.statUnderline, active && st.statUnderlineActive]} />
                </TouchableOpacity>
                {i < arr.length - 1 && <View style={st.statDivider} />}
              </React.Fragment>
            );
          })}
        </View>

        {/* Citizen DNA — shown when user_wave_stats data is available */}
        {profile?.dna?.length > 0 && (
          <View style={st.dnaSection}>
            <View style={st.dnaSectionHeader}>
              <Text style={st.dnaSectionTitle}>Citizen DNA</Text>
              <View style={st.dnaPrivacyRow}>
                <Text style={st.dnaPrivacyIcon}>{isOwnProfile ? '🔒' : '🌍'}</Text>
                <Text style={st.dnaPrivacyText}>{isOwnProfile ? 'Only you' : 'Public'}</Text>
              </View>
            </View>
            <View style={[st.dnaChart, { backgroundColor: C.surface, borderColor: C.border }]}>
              <CitizenDNAChart
                data={profile.dna}
                color={isOwnProfile ? C.accent : '#059669'}
                gridColor={C.border}
              />
            </View>
          </View>
        )}

        {/* Tab content */}
        <View style={st.gridSection}>
          {tab === 'sentis' && (
            sentis.length === 0 ? (
              <EmptyState icon="🌊" headline="No sentis floated yet"
                subtext="Your floated sentis will appear here" style={st.gridEmptyState} />
            ) : (
              <View style={st.grid}>
                {sentis.map((item) => (
                  <SentiTile key={item.id} senti={item} width={TILE_W} onPress={() => onOpenSenti?.(item.id)} />
                ))}
              </View>
            )
          )}

          {tab === 'reacts' && (
            reacts === null || tabBusy ? (
              <View style={st.tabLoader}><ActivityIndicator color={C.accent} /></View>
            ) : reacts.length === 0 ? (
              <EmptyState icon="🌊" headline="No reactions yet"
                subtext="Sentis this citizen reacts to show up here" style={st.gridEmptyState} />
            ) : (
              <View style={st.grid}>
                {reacts.map((item) => (
                  <SentiTile key={item.id} senti={item} width={TILE_W} onPress={() => onOpenSenti?.(item.id)} />
                ))}
              </View>
            )
          )}

          {tab === 'followers' && (
            followers === null || tabBusy ? (
              <View style={st.tabLoader}><ActivityIndicator color={C.accent} /></View>
            ) : followers.length === 0 ? (
              <EmptyState icon="🫂" headline="No followers yet"
                subtext="When citizens follow, they appear here" style={st.gridEmptyState} />
            ) : (
              <View style={st.grid}>
                {followers.map((p) => (
                  <PersonTile key={p.id} person={p} width={TILE_W} onPress={onOpenUser ? () => onOpenUser(p.id) : undefined} />
                ))}
              </View>
            )
          )}

          {tab === 'following' && (
            followingList === null || tabBusy ? (
              <View style={st.tabLoader}><ActivityIndicator color={C.accent} /></View>
            ) : followingList.length === 0 ? (
              <EmptyState icon="🫂" headline="Not following anyone"
                subtext="Profiles this citizen follows appear here" style={st.gridEmptyState} />
            ) : (
              <View style={st.grid}>
                {followingList.map((p) => (
                  <PersonTile key={p.id} person={p} width={TILE_W} onPress={onOpenUser ? () => onOpenUser(p.id) : undefined} />
                ))}
              </View>
            )
          )}
        </View>

      </ScrollView>

      {/* Edit profile sheet — own profile only */}
      <EditProfileSheet
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        initial={{
          username:    profile?.username ?? '',
          displayName: profile?.displayName ?? '',
          bio:         profile?.bio ?? '',
          avatarUrl:   profile?.avatarUrl ?? null,
        }}
        onSaved={(u) => setProfile((prev) => prev ? {
          ...prev,
          username:    u.username,
          displayName: u.display_name ?? '',
          bio:         u.bio ?? '',
          // avatar_url is only present in the update when a new photo was uploaded
          avatarUrl:   u.avatar_url !== undefined ? u.avatar_url : prev.avatarUrl,
        } : prev)}
      />

      {/* Full-screen avatar viewer — tap the profile picture to open */}
      <Modal
        visible={viewerOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setViewerOpen(false)}
      >
        <TouchableOpacity style={st.viewerBackdrop} activeOpacity={1} onPress={() => setViewerOpen(false)}>
          {profile?.avatarUrl && (
            <Image source={{ uri: profile.avatarUrl }} style={st.viewerImg} resizeMode="contain" />
          )}
        </TouchableOpacity>
      </Modal>
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
        const o = getPoint(i, RADIUS);
        return <Line key={i} x1={CX} y1={CY} x2={o.x} y2={o.y} stroke={gridColor} strokeWidth="0.5" />;
      })}
      <Polygon
        points={dataPoints.map((p) => `${p.x},${p.y}`).join(' ')}
        fill={`${color}30`} stroke={color} strokeWidth="1.5"
      />
      {dataPoints.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r="2.5" fill={color} />)}
      {data.slice(0, N).map((d, i) => {
        const lp = getPoint(i, RADIUS + 12);
        return (
          <SvgText key={i} x={lp.x} y={lp.y} textAnchor="middle" fontSize="6.5" fill="#6B7280" fontWeight="600">
            {WAVE_EMOJIS[d.wave] ?? '🌊'} {d.wave}
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
    alignItems: 'center', paddingHorizontal: ms(16), paddingTop: vs(10), paddingBottom: 0,
  },
  backBtn:     { flexDirection: 'row', alignItems: 'center', gap: ms(6) },
  backIcon:    { fontSize: fs(20), color: C.textPrimary },                 // was fs(18) ×1.10
  headerTitle: { fontSize: fs(18), fontWeight: '800', color: C.textPrimary }, // was fs(16) ×1.10
  settingsIcon: { fontSize: fs(22) },                                       // was fs(20) ×1.10
  avatarRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: ms(16), paddingTop: vs(12), gap: ms(12),
  },
  avatar: {
    width: s(50), height: s(50), borderRadius: s(25),
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },   // fill parent circle
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.93)', alignItems: 'center', justifyContent: 'center' },
  viewerImg:      { width: '92%', height: '72%' },
  avatarText:  { fontSize: fs(22), fontWeight: '800', color: '#FFFFFF' },   // was fs(20) ×1.10
  nameBlock:   { flex: 1 },
  displayName: { fontSize: fs(18), fontWeight: '800', color: C.textPrimary }, // was fs(16) ×1.10
  username:    { fontSize: fs(14), fontWeight: '500', color: C.textMuted },   // was fs(13) ×1.10
  actionButtons: { flexDirection: 'column', gap: vs(5), alignItems: 'flex-end', flexShrink: 0 },
  editBtn: {
    paddingVertical: vs(5), paddingHorizontal: ms(14), borderRadius: ms(20),
    backgroundColor: C.surfaceAlt, borderWidth: 0.5, borderColor: C.border,
  },
  editText:    { fontSize: fs(14), fontWeight: '700', color: C.textSecondary }, // was fs(13) ×1.10
  followBtn:   { paddingVertical: vs(5), paddingHorizontal: ms(14), borderRadius: ms(20), backgroundColor: C.accent },
  followingBtn: { backgroundColor: C.surfaceAlt, borderWidth: 0.5, borderColor: C.border },
  followText:   { fontSize: fs(14), fontWeight: '700', color: '#FFFFFF' },      // was fs(13) ×1.10
  followingText: { color: C.textSecondary },
  askBtn: {
    paddingVertical: vs(4), paddingHorizontal: ms(12), borderRadius: ms(20),
    backgroundColor: C.surfaceAlt, borderWidth: 0.5, borderColor: C.border,
  },
  askText:     { fontSize: fs(14), fontWeight: '700', color: C.textSecondary }, // was fs(13) ×1.10
  bioText: {
    fontSize: fs(14), fontWeight: '400', color: C.textSecondary,
    lineHeight: fs(20), paddingHorizontal: ms(16), paddingTop: vs(8),
  },
  statsRow:    { flexDirection: 'row', paddingHorizontal: ms(16), paddingTop: vs(12) },
  statItem:    { flex: 1, alignItems: 'center', gap: vs(2) },
  statValue:   { fontSize: fs(19), fontWeight: '800', color: C.textPrimary },   // was fs(17) ×1.10
  statValueActive: { color: C.accent },
  statLabel:   { fontSize: fs(12), fontWeight: '600', color: C.textMuted },     // was fs(11) ×1.10
  statLabelActive: { color: C.accent },
  statUnderline:       { marginTop: vs(4), height: vs(2), width: ms(22), borderRadius: ms(2), backgroundColor: 'transparent' },
  statUnderlineActive: { backgroundColor: C.accent },
  statDivider: { width: 0.5, backgroundColor: C.border, marginHorizontal: ms(4) },
  tabLoader:   { paddingVertical: vs(36), alignItems: 'center', justifyContent: 'center' },
  dnaSection:  { paddingHorizontal: ms(16), paddingTop: vs(12) },
  dnaSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: vs(6) },
  dnaSectionTitle:  { fontSize: fs(14), fontWeight: '700', color: C.textPrimary }, // was fs(13) ×1.10
  dnaPrivacyRow:    { flexDirection: 'row', alignItems: 'center', gap: ms(4) },
  dnaPrivacyIcon:   { fontSize: fs(13) },                                         // was fs(12) ×1.10
  dnaPrivacyText:   { fontSize: fs(12), fontWeight: '600', color: C.textMuted },  // was fs(11) ×1.10
  dnaChart:         { borderRadius: ms(14), padding: ms(8), borderWidth: 0.5 },
  gridSection: { paddingHorizontal: ms(16), paddingTop: vs(10), paddingBottom: vs(24) },
  gridHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: vs(8) },
  gridTitle:   { fontSize: fs(14), fontWeight: '700', color: C.textPrimary },   // was fs(13) ×1.10
  gridCount:   { fontSize: fs(13), fontWeight: '600', color: C.textMuted },     // was fs(12) ×1.10
  gridEmpty:   { fontSize: fs(15), textAlign: 'center', paddingVertical: vs(24) }, // was fs(14) ×1.10
  // EmptyState defaults to flex:1; inside this ScrollView section we need a
  // content-sized block instead, so override flex and give it vertical room.
  gridEmptyState: { flex: 0, paddingVertical: vs(32) },
  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  // Tile: square, text centered and filling the box
  tile:        { borderRadius: ms(10), overflow: 'hidden', justifyContent: 'center', alignItems: 'center', padding: ms(6) },
  tileText:    { fontSize: fs(10), fontWeight: '700', color: 'rgba(255,255,255,0.92)', lineHeight: fs(14), textAlign: 'center' }, // was fs(9) ×1.10
});
