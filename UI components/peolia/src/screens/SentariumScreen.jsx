// ─────────────────────────────────────────────
// Peolia — SentariumScreen
// src/screens/SentariumScreen.jsx
//
// The main feed. Full-screen vertical swipe,
// one senti per screen (TikTok style).
//
// Replaces: FeedScreen.jsx
// ─────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, FlatList, StyleSheet, Dimensions,
  useColorScheme, ActivityIndicator, Text,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { getPeoliaColors } from '../constants/peoliaTheme';
import SentiCard from '../components/SentiCard';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SentariumScreen() {
  const scheme = useColorScheme();
  const C = getPeoliaColors(scheme);
  const s = makeStyles(C);

  const [sentis,    setSentis]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [userVotes, setUserVotes] = useState({}); // { sentiId: 'yes'|'hmm'|'nah' }
  const [viewLocks, setViewLocks] = useState({}); // { sentiId: true } — viewed without voting

  // ── Fetch sentis ──────────────────────────────
  const fetchSentis = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sentis')               // TODO: update table name from 'opinions' to 'sentis'
        .select(`
          id, question, description, wave,
          created_at, image_url,
          users(username, avatar_initials),
          senti_counts(likes, voices, pins,
            yes_count, hmm_count, nah_count, total_reacts)
        `)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;

      // Normalise data shape
      const normalised = (data ?? []).map((item) => {
        const counts = item.senti_counts?.[0] ?? {};
        const total  = counts.total_reacts || 1;
        return {
          id:          item.id,
          question:    item.question,
          description: item.description,
          wave:        item.wave ?? 'Tech',
          imageUrl:    item.image_url,
          creator: {
            initials: item.users?.avatar_initials ?? '??',
          },
          likes:   counts.likes   ?? 0,
          voices:  counts.voices  ?? 0,
          pins:    counts.pins    ?? 0,
          results: {
            yes: {
              pct:   Math.round(((counts.yes_count ?? 0) / total) * 100),
              count: formatCount(counts.yes_count ?? 0),
            },
            hmm: {
              pct:   Math.round(((counts.hmm_count ?? 0) / total) * 100),
              count: formatCount(counts.hmm_count ?? 0),
            },
            nah: {
              pct:   Math.round(((counts.nah_count ?? 0) / total) * 100),
              count: formatCount(counts.nah_count ?? 0),
            },
          },
        };
      });

      setSentis(normalised);
    } catch (err) {
      console.error('SentariumScreen: fetchSentis error', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSentis();

    // Real-time: new senti floated
    const channel = supabase
      .channel('sentarium-feed')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sentis' },
        (payload) => {
          if (payload.new.status === 'approved') {
            fetchSentis(); // simple refetch — optimise later
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [fetchSentis]);

  // ── Vote handler ──────────────────────────────
  const handleVote = async (sentiId, choice) => {
    // Optimistic update
    setUserVotes((prev) => ({ ...prev, [sentiId]: choice }));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return; // guest — should show sign up prompt

      const { error } = await supabase
        .from('senti_reactions')
        .upsert({
          senti_id:  sentiId,
          user_id:   user.id,
          reaction:  choice,           // 'yes' | 'hmm' | 'nah'
          reacted_at: new Date().toISOString(),
        }, { onConflict: 'senti_id,user_id' });

      if (error) {
        // Rollback optimistic update
        setUserVotes((prev) => { const n = {...prev}; delete n[sentiId]; return n; });
        console.error('handleVote error', error);
      }
    } catch (err) {
      console.error('handleVote exception', err);
    }
  };

  // ── Like handler ──────────────────────────────
  const handleLike = async (sentiId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('senti_likes').upsert({
        senti_id: sentiId, user_id: user.id,
      }, { onConflict: 'senti_id,user_id' });
    } catch (err) {
      console.error('handleLike error', err);
    }
  };

  // ── Pin handler ───────────────────────────────
  const handlePin = async (sentiId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('senti_pins').upsert({
        senti_id: sentiId, user_id: user.id,
      }, { onConflict: 'senti_id,user_id' });
    } catch (err) {
      console.error('handlePin error', err);
    }
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

  return (
    <FlatList
      data={sentis}
      keyExtractor={(item) => item.id}
      pagingEnabled
      showsVerticalScrollIndicator={false}
      snapToInterval={SCREEN_HEIGHT}
      decelerationRate="fast"
      renderItem={({ item }) => (
        <View style={s.page}>
          <SentiCard
            senti={item}
            onVote={handleVote}
            onLike={handleLike}
            onVoice={(id) => console.log('open voices for', id)} // TODO: open voice screen
            onPin={handlePin}
            onAsk={(id) => console.log('ask share for', id)}    // TODO: share sheet
            userVote={userVotes[item.id] ?? null}
            userViewedReacts={viewLocks[item.id] ?? false}
          />
        </View>
      )}
    />
  );
}

// Helpers
const formatCount = (n) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

const makeStyles = (C) => StyleSheet.create({
  page: {
    height: SCREEN_HEIGHT,
    width: SCREEN_WIDTH,
    backgroundColor: C.bg,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bg,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bg,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.textSecondary,
    textAlign: 'center',
  },
});
