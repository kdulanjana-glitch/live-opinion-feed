// ─────────────────────────────────────────────
// Peolia — SentariumScreen
// Replaces: FeedScreen.jsx
//
// DB mapping (existing schema):
//   opinions.text       → senti.question
//   opinions.category   → senti.wave  (capitalised)
//   opinions.created_by → creator.userId
//   opinion_likes       → pins/likes table (mapped)
//   opinion_saves       → pin action
//   votes               → reactions (yes/hmm/nah values)
// ─────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, FlatList, StyleSheet, Dimensions,
  useColorScheme, ActivityIndicator, Text,
  StatusBar, Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { getPeoliaColors } from '../constants/peoliaTheme';
import SentiCard from '../components/SentiCard';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Tech');
const formatCount = (n) => {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

// Normalize a raw opinion row into the shape SentiCard expects
const normalise = (item) => {
  const total        = item.total_votes   || 1;
  const agreeCount   = item.agree_count   || 0;
  const disagreeCount = item.disagree_count || 0;
  // Map: agree→yes, disagree→nah, remainder→hmm
  const hmmCount     = Math.max(0, total - agreeCount - disagreeCount);
  return {
    id:          item.id,
    question:    item.text,
    description: item.description,
    wave:        capitalize(item.category || 'life'),
    imageUrl:    null,
    creator: {
      initials: ((item.users?.username || item.created_by || '?')[0]).toUpperCase(),
      userId:   item.created_by,
    },
    likes:   item.like_count    || 0,
    voices:  item.comment_count || 0,
    pins:    item.save_count    || 0,
    results: {
      yes: { pct: Math.round((agreeCount    / total) * 100), count: formatCount(agreeCount)    },
      hmm: { pct: Math.round((hmmCount      / total) * 100), count: formatCount(hmmCount)      },
      nah: { pct: Math.round((disagreeCount / total) * 100), count: formatCount(disagreeCount) },
    },
  };
};

export default function SentariumScreen({
  session,
  onRequireAuth,
  onNavigateToUser,
  scrollToId,
  onScrolled,
}) {
  const scheme = useColorScheme();
  const C = getPeoliaColors(scheme);
  const s = makeStyles(C);

  const [sentis,    setSentis]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [listHeight, setListHeight] = useState(0);
  const [userVotes, setUserVotes] = useState({}); // { opinionId: 'yes'|'hmm'|'nah' }
  const [viewLocks, setViewLocks] = useState({}); // { opinionId: true }

  const flatListRef    = useRef(null);
  const sentisRef      = useRef([]);
  const sessionRef     = useRef(session);
  const pendingScrollRef = useRef(scrollToId || null);

  useEffect(() => { sentisRef.current = sentis; },  [sentis]);
  useEffect(() => { sessionRef.current = session; }, [session]);

  // ── Fetch opinions ────────────────────────────
  const fetchSentis = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('opinions')
        .select('*, users(username)')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;

      let normalised = (data ?? []).map(normalise);
      normalised = normalised.sort(() => Math.random() - 0.5);

      // Handle pending scroll target — move it to index 0
      const targetId = pendingScrollRef.current;
      if (targetId) {
        const idx = normalised.findIndex((s) => s.id === targetId);
        if (idx > 0) {
          const [t] = normalised.splice(idx, 1);
          normalised.unshift(t);
        } else if (idx < 0) {
          const { data: t } = await supabase
            .from('opinions')
            .select('*, users(username)')
            .eq('id', targetId)
            .maybeSingle();
          if (t) normalised.unshift(normalise(t));
        }
        setTimeout(() => { pendingScrollRef.current = null; onScrolled?.(); }, 400);
      }

      setSentis(normalised);
    } catch (err) {
      console.error('SentariumScreen fetchSentis error', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Realtime channels ────────────────────────
  useEffect(() => {
    fetchSentis();

    const insertChannel = supabase.channel('sentarium-inserts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'opinions' },
        (payload) => {
          if (payload.new.status === 'approved') {
            setSentis((prev) => [normalise(payload.new), ...prev]);
          }
        })
      .subscribe();

    const updateChannel = supabase.channel('sentarium-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'opinions' },
        (payload) => {
          setSentis((prev) =>
            prev.map((s) => s.id === payload.new.id ? normalise(payload.new) : s)
          );
        })
      .subscribe();

    return () => {
      supabase.removeChannel(insertChannel);
      supabase.removeChannel(updateChannel);
    };
  }, [fetchSentis]);

  // ── scrollToId prop changes (navigate from Trending/Saved) ──
  useEffect(() => {
    if (!scrollToId) return;
    pendingScrollRef.current = scrollToId;
    if (sentisRef.current.length > 0) {
      const idx = sentisRef.current.findIndex((s) => s.id === scrollToId);
      if (idx !== 0) {
        setSentis((prev) => {
          const copy = [...prev];
          const target = copy.find((s) => s.id === scrollToId);
          if (!target) return prev;
          return [target, ...copy.filter((s) => s.id !== scrollToId)];
        });
      }
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
        pendingScrollRef.current = null;
        onScrolled?.();
      }, 200);
    }
  }, [scrollToId]);

  // ── Fetch existing vote when a card becomes visible ──
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (!viewableItems.length) return;
    const item = viewableItems[0].item;
    if (!item || !sessionRef.current?.user?.id) return;
    const uid = sessionRef.current.user.id;
    const today = new Date().toISOString().split('T')[0];
    supabase.from('votes')
      .select('vote_value')
      .eq('user_id', uid)
      .eq('opinion_id', item.id)
      .eq('voted_date', today)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.vote_value) {
          setUserVotes((prev) => ({ ...prev, [item.id]: data.vote_value }));
        }
      });
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  // ── Infinite shuffle ────────────────────────
  const handleEndReached = useCallback(() => {
    const more = [...sentisRef.current].sort(() => Math.random() - 0.5);
    setSentis((prev) => [...prev, ...more]);
  }, []);

  // ── Vote handler ─────────────────────────────
  const handleVote = async (opinionId, choice) => {
    if (!sessionRef.current?.user?.id) { onRequireAuth?.(); return; }
    const uid = sessionRef.current.user.id;
    setUserVotes((prev) => ({ ...prev, [opinionId]: choice }));
    try {
      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase.from('votes').insert({
        user_id:    uid,
        opinion_id: opinionId,
        vote_value: choice,   // 'yes' | 'hmm' | 'nah'
        voted_date: today,
      });
      if (error) {
        setUserVotes((prev) => { const n = { ...prev }; delete n[opinionId]; return n; });
        console.error('handleVote error', error);
      }
    } catch (err) {
      console.error('handleVote exception', err);
    }
  };

  // ── Like handler ─────────────────────────────
  const handleLike = async (opinionId) => {
    if (!sessionRef.current?.user?.id) { onRequireAuth?.(); return; }
    const uid = sessionRef.current.user.id;
    try {
      await supabase.from('opinion_likes')
        .insert({ user_id: uid, opinion_id: opinionId });
    } catch (err) { console.error('handleLike error', err); }
  };

  // ── Pin = Save handler ───────────────────────
  const handlePin = async (opinionId) => {
    if (!sessionRef.current?.user?.id) { onRequireAuth?.(); return; }
    const uid = sessionRef.current.user.id;
    try {
      await supabase.from('opinion_saves')
        .insert({ user_id: uid, opinion_id: opinionId });
    } catch (err) { console.error('handlePin error', err); }
  };

  // ── Render ────────────────────────────────────
  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  if (sentis.length === 0) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyText}>The Sentarium is quiet. Be the first to float.</Text>
      </View>
    );
  }

  const itemHeight = listHeight > 0 ? listHeight : SCREEN_HEIGHT;

  return (
    <View style={s.screen}>
      <StatusBar
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={C.bg}
      />
      <FlatList
        ref={flatListRef}
        data={sentis}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onEndReached={handleEndReached}
        onEndReachedThreshold={3}
        removeClippedSubviews
        windowSize={5}
        maxToRenderPerBatch={3}
        initialNumToRender={2}
        onLayout={(e) => setListHeight(e.nativeEvent.layout.height)}
        renderItem={({ item }) => (
          <View style={{ height: itemHeight, backgroundColor: C.bg }}>
            <SentiCard
              senti={item}
              onVote={handleVote}
              onLike={handleLike}
              onVoice={(id) => { /* comments — future */ }}
              onPin={handlePin}
              onAsk={(id) => { /* share — future */ }}
              onAvatarPress={
                item.creator?.userId
                  ? () => {
                      if (!sessionRef.current?.user?.id) { onRequireAuth?.(); return; }
                      onNavigateToUser?.(item.creator.userId);
                    }
                  : undefined
              }
              userVote={userVotes[item.id] ?? null}
              userViewedReacts={viewLocks[item.id] ?? false}
            />
          </View>
        )}
      />
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0,
  },
  loader: {
    flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg,
  },
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.bg, paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 14, fontWeight: '600', color: C.textSecondary, textAlign: 'center',
  },
});
