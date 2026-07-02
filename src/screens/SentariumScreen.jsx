// ─────────────────────────────────────────────
// Peolia — SentariumScreen
// src/screens/SentariumScreen.jsx
//
// Data layer (new schema):
//   sentarium_feed     — paginated fetch (cursor = created_at, 10 / page)
//                        pre-fetches next page when card 7 becomes visible
//   senti_counts       — realtime subscription for visible card only
//   senti_reactions    — insert on vote  (onConflict: ignore, votes immutable)
//   senti_likes        — insert on like  (onConflict: ignore)
//   senti_pins         — insert on pin   (onConflict: ignore)
//   senti_view_locks   — insert on "View anyway" confirm
// ─────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Text,
  StatusBar,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { PeoliaFonts as F , getPeoliaColors } from '../constants/peoliaTheme';
import { usePeoliaScheme } from '../context/ThemeContext';
import { useBlocks } from '../context/BlockContext';
import { useWavePrefs } from '../context/WavePrefsContext';
import { supabase } from '../lib/supabase';

import { SCREEN_HEIGHT, ms, vs, fs } from '../utils/peoliaScale';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import SentiCard   from '../components/SentiCard';
import VoiceSheet  from '../components/VoiceSheet';
import ReportSheet from '../components/ReportSheet';
import ShareCard   from '../components/ShareCard';
import EmptyState  from '../components/EmptyState';
import { FeedSkeleton } from '../components/Skeletons';

// ── Constants ─────────────────────────────────
const PAGE_SIZE   = 10;
const PREFETCH_AT = 3;  // prefetch when this many cards remain

// Wave-preference feed shaping. We fetch a larger pool, then select TARGET
// sentis weighted by each wave's Low/Mid/High level (excluded waves dropped).
const FETCH_POOL    = 90;
const TARGET        = 30;
const LEVEL_WEIGHTS = { high: 100, mid: 50, low: 20 };

// Pure: take the raw (normalised) pool, return a TARGET-sized weighted selection.
// No DB calls. Excluded waves are dropped; remaining waves get slots proportional
// to their level weight; pools and final order are shuffled.
const applyWavePreferences = (sentis, wavePrefs) => {
  const filtered = sentis.filter((s) => !wavePrefs[s.wave]?.excluded);

  const byWave = {};
  filtered.forEach((s) => { (byWave[s.wave] ??= []).push(s); });

  const waves = Object.keys(byWave);
  const totalWeight = waves.reduce(
    (sum, wave) => sum + LEVEL_WEIGHTS[wavePrefs[wave]?.level ?? 'high'],
    0,
  );
  if (totalWeight === 0) return filtered.slice(0, TARGET);

  const selected = [];
  waves.forEach((wave) => {
    const weight = LEVEL_WEIGHTS[wavePrefs[wave]?.level ?? 'high'];
    const slots  = Math.max(1, Math.round((weight / totalWeight) * TARGET));
    const pool   = [...byWave[wave]].sort(() => Math.random() - 0.5);
    selected.push(...pool.slice(0, Math.min(slots, pool.length)));
  });

  return selected.sort(() => Math.random() - 0.5).slice(0, TARGET);
};

// Apply a "creator is not blocked" filter to a sentarium_feed query.
// PostgREST not-in list — quote each uuid so any value form is accepted.
const applyBlockFilter = (query, hiddenIds) =>
  hiddenIds.length
    ? query.not('user_id', 'in', `(${hiddenIds.map((id) => `"${id}"`).join(',')})`)
    : query;

// ── Helpers ───────────────────────────────────
const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Tech');

const formatCount = (n) => {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

const buildResults = (yes = 0, hmm = 0, nah = 0) => {
  const t = (yes + hmm + nah) || 1;
  return {
    yes: { pct: Math.round((yes / t) * 100), count: formatCount(yes) },
    hmm: { pct: Math.round((hmm / t) * 100), count: formatCount(hmm) },
    nah: { pct: Math.round((nah / t) * 100), count: formatCount(nah) },
  };
};

// Normalise sentarium_feed row → SentiCard shape
// sentis.user_id is the creator FK (not created_by)
const normalise = (item) => ({
  id:          item.id,
  question:    item.question,
  description: item.description ?? '',
  wave:        capitalize(item.wave ?? 'tech'),
  imageUrl:    item.image_url ?? null,
  creator: {
    // View's stored avatar_initials is stale ('??') — always derive from username.
    // user_id / avatar_url exist only after the sentarium_feed v2 SQL is applied;
    // until then they come back undefined and the avatar tap stays disabled.
    initials:  item.username?.[0]?.toUpperCase() ?? '?',
    username:  item.username ?? null,
    userId:    item.user_id ?? null,         // sentis.user_id
    avatarUrl: item.avatar_url ?? null,
  },
  likes:      item.likes   ?? 0,
  voices:     item.voices  ?? 0,
  pins:       item.pins    ?? 0,
  // Raw vote tallies — needed for optimistic vote math (results only holds pct + formatted strings)
  rawCounts:  { yes: item.yes_count ?? 0, hmm: item.hmm_count ?? 0, nah: item.nah_count ?? 0 },
  results:    buildResults(item.yes_count, item.hmm_count, item.nah_count),
  created_at: item.created_at,
});

// ── Component ─────────────────────────────────
export default function SentariumScreen({
  session,
  onRequireAuth,
  onNavigateToUser,
  scrollToId,
  onScrolled,
  focusSenti,   // { id, openVoice, token } | null — notification / cross-screen deep-link
  onShareSentiToDM,   // (sentiId) → open the share-to-DM picker
}) {
  const scheme = usePeoliaScheme();
  const C      = getPeoliaColors(scheme);
  const st     = makeStyles(C);
  const { hiddenIds } = useBlocks();
  const { wavePrefs } = useWavePrefs();   // shared — changes re-shape the feed live

  const [sentis,        setSentis]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [loadError,     setLoadError]     = useState(false);
  const [loadingMore,   setLoadingMore]   = useState(false);
  const [listHeight,    setListHeight]    = useState(0);
  const [userVotes,     setUserVotes]     = useState({}); // { sentiId: 'yes'|'hmm'|'nah' }
  const [userViewLocks, setUserViewLocks] = useState({}); // { sentiId: true }
  const [likedSentis,   setLikedSentis]   = useState({}); // { sentiId: true/false }
  const [pinnedSentis,  setPinnedSentis]  = useState({}); // { sentiId: true/false }
  const [voiceSentiId,  setVoiceSentiId]  = useState(null); // sentiId for open VoiceSheet
  const [reportSentiId, setReportSentiId] = useState(null); // sentiId for open ReportSheet
  const [reportBusy,    setReportBusy]    = useState(false);
  const [shareSenti,    setShareSenti]    = useState(null);  // senti mounted off-screen for share-card capture

  // Refs — avoid stale closures in callbacks
  const flatListRef       = useRef(null);
  const shareCardRef      = useRef(null);
  const sentisRef         = useRef([]);
  const sessionRef        = useRef(session);
  const onScrolledRef     = useRef(onScrolled);
  const visibleChannelRef = useRef(null);
  const cursorRef         = useRef(null);
  const hasMoreRef        = useRef(true);
  const loadingMoreRef    = useRef(false);
  const pendingScrollRef  = useRef(scrollToId ?? null);
  const stateLoadingRef   = useRef(new Set());
  // Mirrors updated BOTH via useEffect (catches batchFetchStates updates)
  // AND synchronously in handlers (catches rapid double-taps before effect fires).
  const likedSentisRef    = useRef({});
  const pinnedSentisRef   = useRef({});
  // Mirror blocked-user ids so the stable fetch callbacks read the latest set
  const hiddenIdsRef      = useRef([]);
  // Mirror wave prefs so the stable fetchSentis callback reads the latest set
  const wavePrefsRef      = useRef({});
  // One DB call at a time per senti — block any tap while a call is in-flight
  const perSentiLikeInFlight = useRef({}); // { sentiId: true }
  const perSentiPinInFlight  = useRef({}); // { sentiId: true }

  useEffect(() => { sentisRef.current     = sentis;     }, [sentis]);
  useEffect(() => { sessionRef.current    = session;    }, [session]);
  useEffect(() => { onScrolledRef.current = onScrolled; }, [onScrolled]);
  // Sync refs from state so batchFetchStates results are visible to handlers
  useEffect(() => { likedSentisRef.current  = likedSentis;  }, [likedSentis]);
  useEffect(() => { pinnedSentisRef.current = pinnedSentis; }, [pinnedSentis]);
  useEffect(() => { wavePrefsRef.current    = wavePrefs;    }, [wavePrefs]);

  // ── Blocked users: keep ref in sync + drop any already-loaded blocked cards ──
  // Covers the case where the citizen blocks someone from a profile overlay and
  // returns to the feed — their cards vanish without a refetch.
  useEffect(() => {
    hiddenIdsRef.current = hiddenIds;
    if (!hiddenIds.length) return;
    const hidden = new Set(hiddenIds);
    setSentis((prev) => prev.filter((s) => !hidden.has(s.creator?.userId)));
  }, [hiddenIds]);

  // ── Per-card realtime: subscribe / unsubscribe ─
  const subscribeToVisible = useCallback((sentiId) => {
    if (visibleChannelRef.current) {
      supabase.removeChannel(visibleChannelRef.current);
      visibleChannelRef.current = null;
    }
    if (!sentiId) return;

    visibleChannelRef.current = supabase
      .channel(`senti-counts-${sentiId}`)
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'senti_counts',
        filter: `senti_id=eq.${sentiId}`,
      }, ({ new: c }) => {
        const suppressLikePin =
          perSentiLikeInFlight.current[sentiId] || perSentiPinInFlight.current[sentiId];
        setSentis((prev) => prev.map((item) =>
          item.id !== sentiId ? item : {
            ...item,
            likes:   suppressLikePin ? item.likes  : (c.likes   ?? item.likes),
            voices:  c.voices  ?? item.voices,
            pins:    suppressLikePin ? item.pins   : (c.pins    ?? item.pins),
            rawCounts: { yes: c.yes_count ?? 0, hmm: c.hmm_count ?? 0, nah: c.nah_count ?? 0 },
            results: buildResults(c.yes_count, c.hmm_count, c.nah_count),
          }
        ));
      })
      .subscribe();
  }, []);

  // ── Batch-fetch reaction state for a whole page ─────────────────────────
  // Called fire-and-forget after every fetchSentis / fetchMore.
  // ONE query covers all cards on the page — eliminates the per-card
  // N×1 queries that caused the 1-second flash on normal feed scrolling.
  const batchFetchStates = useCallback((sentiIds) => {
    const uid = sessionRef.current?.user?.id;
    if (!uid || !sentiIds.length) return;

    // Block votes on all new cards until their DB state is confirmed
    sentiIds.forEach((id) => stateLoadingRef.current.add(id));

    Promise.all([
      supabase.from('senti_reactions').select('senti_id, reaction')
        .eq('user_id', uid).in('senti_id', sentiIds),
      supabase.from('senti_view_locks').select('senti_id')
        .eq('user_id', uid).in('senti_id', sentiIds),
      supabase.from('senti_likes').select('senti_id')
        .eq('user_id', uid).in('senti_id', sentiIds),
      supabase.from('senti_pins').select('senti_id')
        .eq('user_id', uid).in('senti_id', sentiIds),
    ]).then(([reactRes, lockRes, likeRes, pinRes]) => {
      const votes = {};
      (reactRes.data ?? []).forEach((r) => { votes[r.senti_id] = r.reaction; });
      if (Object.keys(votes).length) setUserVotes((prev) => ({ ...prev, ...votes }));

      const locks = {};
      (lockRes.data ?? []).forEach((l) => { locks[l.senti_id] = true; });
      if (Object.keys(locks).length) setUserViewLocks((prev) => ({ ...prev, ...locks }));

      const likes = {};
      (likeRes.data ?? []).forEach((l) => { likes[l.senti_id] = true; });
      if (Object.keys(likes).length) {
        setLikedSentis((prev) => ({ ...prev, ...likes }));
        likedSentisRef.current = { ...likedSentisRef.current, ...likes };
      }

      const pins = {};
      (pinRes.data ?? []).forEach((p) => { pins[p.senti_id] = true; });
      if (Object.keys(pins).length) {
        setPinnedSentis((prev) => ({ ...prev, ...pins }));
        pinnedSentisRef.current = { ...pinnedSentisRef.current, ...pins };
      }

      // Unblock all cards
      sentiIds.forEach((id) => stateLoadingRef.current.delete(id));
    }).catch(() => {
      sentiIds.forEach((id) => stateLoadingRef.current.delete(id));
    });
  }, []);

  // ── Single-card state fetch — used only for scrollToId pre-fetch ────────
  // (Scroll target may have been individually fetched outside the page batch.)
  const fetchSentiState = useCallback((sentiId) => {
    const uid = sessionRef.current?.user?.id;
    if (!uid) return;
    // Skip if already covered by batchFetchStates
    if (stateLoadingRef.current.has(sentiId)) return;
    // Skip if already known from this session
    // (state is set in userVotes; we can't check here without a ref copy,
    //  so just run — it's a single cheap query)

    stateLoadingRef.current.add(sentiId);

    Promise.all([
      supabase.from('senti_reactions').select('reaction')
        .eq('user_id', uid).eq('senti_id', sentiId).maybeSingle(),
      supabase.from('senti_view_locks').select('senti_id')
        .eq('user_id', uid).eq('senti_id', sentiId).maybeSingle(),
    ]).then(([voteRes, lockRes]) => {
      if (voteRes.data?.reaction) {
        setUserVotes((prev) => ({ ...prev, [sentiId]: voteRes.data.reaction }));
      }
      if (lockRes.data) {
        setUserViewLocks((prev) => ({ ...prev, [sentiId]: true }));
      }
      stateLoadingRef.current.delete(sentiId);
    }).catch(() => {
      stateLoadingRef.current.delete(sentiId);
    });
  }, []);

  // ── Fetch the feed ────────────────────────────
  // Pulls a larger pool (FETCH_POOL), then applyWavePreferences selects TARGET
  // sentis weighted by the citizen's wave levels (excluded waves dropped). This
  // is a one-shot shaped feed — cursor pagination is intentionally disabled so
  // the weighted selection isn't disturbed by appended pages.
  const fetchSentis = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data, error } = await applyBlockFilter(
        supabase
          .from('sentarium_feed')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(FETCH_POOL),
        hiddenIdsRef.current,
      );

      if (error) throw error;

      const normalised = (data ?? []).map(normalise);

      // Shape the pool down to TARGET by wave preference. If prefs haven't loaded
      // yet ({}), keep existing behavior (most-recent slice) — the re-shape effect
      // re-runs once prefs arrive.
      const prefs  = wavePrefsRef.current;
      let items = Object.keys(prefs).length > 0
        ? applyWavePreferences(normalised, prefs)
        : normalised.slice(0, TARGET);

      // Move pending scroll target to index 0 (it may have been shaped out of the
      // selection — a deep-link should still surface it).
      const pending = pendingScrollRef.current;
      if (pending) {
        const idx = items.findIndex((i) => i.id === pending);
        if (idx > 0) {
          const [t] = items.splice(idx, 1);
          items.unshift(t);
        } else if (idx < 0) {
          const inPool = normalised.find((i) => i.id === pending);
          if (inPool) {
            items = items.filter((i) => i.id !== pending);
            items.unshift(inPool);
          } else {
            const { data: single } = await supabase
              .from('sentarium_feed')
              .select('*')
              .eq('id', pending)
              .maybeSingle();
            if (single) items.unshift(normalise(single));
          }
        }
        setTimeout(() => { pendingScrollRef.current = null; onScrolledRef.current?.(); }, 400);
      }

      setSentis(items);
      // Shaped feed is one-shot — disable pagination so fetchMore is a no-op.
      cursorRef.current  = null;
      hasMoreRef.current = false;

      // Batch-fetch reaction state for all selected cards (fire-and-forget)
      batchFetchStates(items.map((i) => i.id));
    } catch (err) {
      console.error('SentariumScreen fetchSentis error', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [batchFetchStates]);

  // ── Fetch next page (cursor pagination) ───────
  const fetchMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current || !cursorRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const { data, error } = await applyBlockFilter(
        supabase
          .from('sentarium_feed')
          .select('*')
          .order('created_at', { ascending: false })
          .lt('created_at', cursorRef.current)
          .limit(PAGE_SIZE),
        hiddenIdsRef.current,
      );

      if (error) throw error;

      const items = (data ?? []).map(normalise);
      // Dedupe — a scroll-target senti fetched individually can reappear in its natural page
      setSentis((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const fresh = items.filter((i) => !seen.has(i.id));
        return fresh.length ? [...prev, ...fresh] : prev;
      });
      if (items.length > 0) cursorRef.current = items.at(-1)?.created_at;
      hasMoreRef.current = (data?.length ?? 0) === PAGE_SIZE;

      // Batch-fetch reaction state for the new page (fire-and-forget)
      batchFetchStates(items.map((i) => i.id));
    } catch (err) {
      console.error('SentariumScreen fetchMore error', err);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [batchFetchStates]);

  // ── Mount / unmount ───────────────────────────
  useEffect(() => {
    fetchSentis();
    return () => {
      if (visibleChannelRef.current) supabase.removeChannel(visibleChannelRef.current);
    };
  }, [fetchSentis]);

  // ── Re-shape on preference change ─────────────
  // When the citizen updates wave prefs in Settings and returns to the feed,
  // re-run the weighting on the already-loaded sentis — no re-fetch. Also catches
  // the mount race where the first fetch ran before prefs finished loading.
  useEffect(() => {
    if (!sentisRef.current?.length || !Object.keys(wavePrefs).length) return;
    setSentis(applyWavePreferences(sentisRef.current, wavePrefs));
     
  }, [wavePrefs]);

  // ── Feed-wide realtime: drop auto-hidden sentis live ──────────────────────
  // When enough reports trip the DB trigger, a senti's status flips to
  // 'under_review'. Every citizen viewing the feed (not just the reporter, who
  // already gets an optimistic local removal in submitReport) sees it vanish
  // without refreshing. One channel for the whole screen, removed on unmount.
  useEffect(() => {
    const channel = supabase
      .channel('sentis-status-feed')
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'sentis',
      }, (payload) => {
        if (
          payload.new?.status === 'under_review' &&
          payload.old?.status !== 'under_review'
        ) {
          setSentis((prev) => prev.filter((s) => s.id !== payload.new.id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── scrollToId prop change ────────────────────
  // The feed stays mounted across tab switches, so this effect (not a remount +
  // fetchSentis) is what handles "open this senti" from Trending/Pin. If the target
  // isn't on a loaded page, fetch it individually and prepend it.
  useEffect(() => {
    if (!scrollToId) return;
    pendingScrollRef.current = scrollToId;
    fetchSentiState(scrollToId);

    let cancelled = false;
    (async () => {
      const existing = sentisRef.current.find((i) => i.id === scrollToId);
      if (existing) {
        setSentis((prev) => [existing, ...prev.filter((i) => i.id !== scrollToId)]);
      } else {
        const { data } = await supabase.from('sentarium_feed').select('*').eq('id', scrollToId).maybeSingle();
        if (cancelled) return;
        if (data) {
          const item = normalise(data);
          setSentis((prev) => (prev.some((i) => i.id === item.id) ? prev : [item, ...prev]));
          batchFetchStates([item.id]);
        }
      }
      setTimeout(() => {
        if (cancelled) return;
        flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
        pendingScrollRef.current = null;
        onScrolledRef.current?.();
      }, 200);
    })();

    return () => { cancelled = true; };
  }, [scrollToId, fetchSentiState, batchFetchStates]);

  // ── focusSenti — notification / cross-screen deep-link (token-driven) ──
  // Like scrollToId, but also optionally opens the VoiceSheet. Depends on the
  // token (not id) so re-tapping the same senti's notification re-triggers even
  // when id + openVoice are unchanged.
  useEffect(() => {
    if (!focusSenti?.id) return;
    const id = focusSenti.id;
    let cancelled = false;

    (async () => {
      const existing = sentisRef.current.find((s) => s.id === id);
      if (existing) {
        setSentis((prev) => [existing, ...prev.filter((s) => s.id !== id)]);
      } else {
        // Not in the loaded window — fetch just this one (via the feed view so
        // normalise() gets the shape it expects) and prepend it.
        const { data } = await supabase.from('sentarium_feed').select('*').eq('id', id).maybeSingle();
        if (cancelled || !data) return;
        const item = normalise(data);
        setSentis((prev) => [item, ...prev.filter((s) => s.id !== item.id)]);
        batchFetchStates([item.id]);
      }
      requestAnimationFrame(() => {
        if (!cancelled) flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      });
      if (focusSenti.openVoice) setVoiceSentiId(id);
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSenti?.token, batchFetchStates]);

  // ── Card becomes visible ──────────────────────
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (!viewableItems.length) return;
    const { item, index } = viewableItems[0];
    if (!item) return;

    // Per-card realtime subscription
    subscribeToVisible(item.id);

    // Pre-fetch next page when PREFETCH_AT cards remain
    const total = sentisRef.current.length;
    if (index >= total - PREFETCH_AT) fetchMore();

    // No per-card state fetch here — batchFetchStates covers the whole page
    // when it loaded. fetchSentiState is only needed for scroll-target cards.
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  // ── Vote — optimistic with rollback ──────────
  const handleVote = useCallback(async (sentiId, choice) => {
    // Gate: reaction state hasn't been confirmed from DB yet — ignore tap.
    // This closes the race window when navigating from Trending / Pin:
    // the card appears briefly in "unvoted" state while the DB check runs.
    if (stateLoadingRef.current.has(sentiId)) return;

    if (!sessionRef.current?.user?.id) { onRequireAuth?.(); return; }
    const uid = sessionRef.current.user.id;

    // Step 1 — optimistic: update local state immediately
    const previous = userVotes[sentiId] ?? null;
    setUserVotes((prev) => ({ ...prev, [sentiId]: choice }));

    // Step 2 — optimistic: recalculate results from raw vote tallies
    setSentis((prev) => prev.map((item) => {
      if (item.id !== sentiId) return item;
      const rc = item.rawCounts ?? { yes: 0, hmm: 0, nah: 0 };
      const next = {
        yes: rc.yes + (choice === 'yes' ? 1 : 0),
        hmm: rc.hmm + (choice === 'hmm' ? 1 : 0),
        nah: rc.nah + (choice === 'nah' ? 1 : 0),
      };
      return { ...item, rawCounts: next, results: buildResults(next.yes, next.hmm, next.nah) };
    }));

    // Step 3 — write to DB in background
    const { error } = await supabase
      .from('senti_reactions')
      .upsert(
        { senti_id: sentiId, user_id: uid, reaction: choice },
        { onConflict: 'senti_id,user_id', ignoreDuplicates: true }
      );

    // Step 4 — if write fails, rollback
    if (error) {
      console.error('handleVote DB error — rolling back', error);
      setUserVotes((prev) => {
        const n = { ...prev };
        if (previous) n[sentiId] = previous;
        else delete n[sentiId];
        return n;
      });
      // Refetch counts to restore true state
      supabase
        .from('senti_counts')
        .select('yes_count, hmm_count, nah_count, likes, voices, pins')
        .eq('senti_id', sentiId)
        .maybeSingle()
        .then(({ data: c }) => {
          if (c) {
            setSentis((prev) => prev.map((item) =>
              item.id !== sentiId ? item : {
                ...item,
                likes:   c.likes,
                voices:  c.voices,
                pins:    c.pins,
                rawCounts: { yes: c.yes_count ?? 0, hmm: c.hmm_count ?? 0, nah: c.nah_count ?? 0 },
                results: buildResults(c.yes_count, c.hmm_count, c.nah_count),
              }
            ));
          }
        });
    }
    // Step 5 — senti_counts realtime will arrive and sync server values automatically
  }, [userVotes, onRequireAuth]);

  // ── Like — in-flight guard, optimistic update, rollback on failure ────────
  const handleLike = useCallback(async (sentiId) => {
    if (!sessionRef.current?.user?.id) { onRequireAuth?.(); return; }
    const wasLiked = !!likedSentisRef.current[sentiId];
    if (perSentiLikeInFlight.current[sentiId]) return;
    perSentiLikeInFlight.current[sentiId] = true;

    const nowLiked = !wasLiked;
    const delta    = nowLiked ? 1 : -1;
    likedSentisRef.current = { ...likedSentisRef.current, [sentiId]: nowLiked };
    setLikedSentis((prev) => ({ ...prev, [sentiId]: nowLiked }));
    setSentis((prev) => prev.map((item) =>
      item.id !== sentiId ? item : { ...item, likes: Math.max(0, item.likes + delta) }
    ));

    const uid = sessionRef.current.user.id;
    try {
      let error;
      if (nowLiked) {
        ({ error } = await supabase.from('senti_likes')
          .insert({ senti_id: sentiId, user_id: uid }));
      } else {
        ({ error } = await supabase.from('senti_likes').delete()
          .eq('user_id', uid).eq('senti_id', sentiId));
      }
      if (error) {
        console.error('handleLike error', error);
        likedSentisRef.current = { ...likedSentisRef.current, [sentiId]: wasLiked };
        setLikedSentis((prev) => ({ ...prev, [sentiId]: wasLiked }));
        setSentis((prev) => prev.map((item) =>
          item.id !== sentiId ? item : { ...item, likes: Math.max(0, item.likes - delta) }
        ));
      }
    } finally {
      perSentiLikeInFlight.current[sentiId] = false;
    }
  }, [onRequireAuth]);

  // ── Ask (share) — capture a branded 1080×1080 card and share it ─
  const handleAsk = useCallback(async (sentiId) => {
    const senti = sentisRef.current.find((i) => i.id === sentiId);
    if (!senti) return;

    // 1. Mount the off-screen card for this senti
    setShareSenti(senti);

    // 2. Wait for it to render before capturing (layout + fonts need a few frames)
    await new Promise((resolve) => setTimeout(resolve, 350));

    try {
      // 3. Capture the off-screen card to a PNG file
      const uri = await captureRef(shareCardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        width: 1080,
        height: 1080,
      });

      // 4. Build the caption — stance variant if THIS user voted, else neutral
      const myVote = userVotes[sentiId] ?? null;
      const stanceWord =
        myVote === 'yes' ? 'I said Yes 🌊' :
        myVote === 'hmm' ? "I'm still on the fence 🤔" :
        myVote === 'nah' ? 'I said Nah ✨' : null;

      const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.peolia.app';

      const caption = stanceWord
        ? `${stanceWord} on this — what's your take?\n\n${PLAY_URL}`
        : `What's your take on this?\n\n${PLAY_URL}`;

      // 5. Share image + caption (caption surfaced via dialog where the target accepts it)
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: caption,
          UTI: 'public.png',
        });
      }
    } catch (err) {
      console.error('handleAsk share error', err);
      Alert.alert('Could not share', 'Please try again.');
    } finally {
      // 6. Unmount the off-screen card
      setShareSenti(null);
    }
  }, [userVotes]);

  // ── Voice (comment) — opens VoiceSheet ────────
  const handleVoice = useCallback((sentiId) => {
    if (!sessionRef.current?.user?.id) { onRequireAuth?.(); return; }
    setVoiceSentiId(sentiId);
  }, [onRequireAuth]);

  // After a voice posts, refetch ONLY that senti's counts row and patch local
  // state — accurate counts (and rawCounts kept in sync for vote math), no full
  // feed refetch, no flicker on other cards.
  const handleVoicePosted = useCallback(async (sentiId) => {
    if (!sentiId) return;
    try {
      const { data, error } = await supabase
        .from('senti_counts')
        .select('likes, voices, pins, yes_count, hmm_count, nah_count')
        .eq('senti_id', sentiId)
        .single();
      if (error || !data) return;
      setSentis((prev) => prev.map((s) =>
        s.id !== sentiId ? s : {
          ...s,
          likes:  data.likes  ?? s.likes,
          voices: data.voices ?? s.voices,
          pins:   data.pins   ?? s.pins,
          rawCounts: { yes: data.yes_count ?? 0, hmm: data.hmm_count ?? 0, nah: data.nah_count ?? 0 },
          results: buildResults(data.yes_count, data.hmm_count, data.nah_count),
        }
      ));
    } catch (err) {
      console.error('handleVoicePosted error', err);
    }
  }, []);

  // ── Flag (report) — opens ReportSheet ─────────
  const handleFlag = useCallback((sentiId) => {
    if (!sessionRef.current?.user?.id) { onRequireAuth?.(); return; }
    setReportSentiId(sentiId);
  }, [onRequireAuth]);

  // Insert the report, then remove the senti from this user's feed
  const submitReport = useCallback(async (reason) => {
    const sentiId = reportSentiId;
    const uid     = sessionRef.current?.user?.id;
    if (!sentiId || !uid) { setReportSentiId(null); return; }

    setReportBusy(true);
    const { error } = await supabase.from('senti_reports')
      .insert({ senti_id: sentiId, reporter_id: uid, reason });
    setReportBusy(false);
    setReportSentiId(null);

    // 23505 = this user already reported it → treat as success (still hide)
    if (error && error.code !== '23505') {
      console.error('submitReport error', error);
      Alert.alert('Could not report', 'Please try again.');
      return;
    }
    setSentis((prev) => prev.filter((item) => item.id !== sentiId));
    Alert.alert('Thanks for reporting', "We've noted this. Our team reviews reports regularly.");
  }, [reportSentiId]);

  // ── Pin — in-flight guard, optimistic update, rollback on failure ──────────
  const handlePin = useCallback(async (sentiId) => {
    if (!sessionRef.current?.user?.id) { onRequireAuth?.(); return; }
    const wasPinned = !!pinnedSentisRef.current[sentiId];
    if (perSentiPinInFlight.current[sentiId]) return;
    perSentiPinInFlight.current[sentiId] = true;

    const nowPinned = !wasPinned;
    const delta     = nowPinned ? 1 : -1;
    pinnedSentisRef.current = { ...pinnedSentisRef.current, [sentiId]: nowPinned };
    setPinnedSentis((prev) => ({ ...prev, [sentiId]: nowPinned }));
    setSentis((prev) => prev.map((item) =>
      item.id !== sentiId ? item : { ...item, pins: Math.max(0, item.pins + delta) }
    ));

    const uid = sessionRef.current.user.id;
    try {
      let error;
      if (nowPinned) {
        ({ error } = await supabase.from('senti_pins')
          .insert({ senti_id: sentiId, user_id: uid }));
      } else {
        ({ error } = await supabase.from('senti_pins').delete()
          .eq('user_id', uid).eq('senti_id', sentiId));
      }
      if (error) {
        console.error('handlePin error', error);
        pinnedSentisRef.current = { ...pinnedSentisRef.current, [sentiId]: wasPinned };
        setPinnedSentis((prev) => ({ ...prev, [sentiId]: wasPinned }));
        setSentis((prev) => prev.map((item) =>
          item.id !== sentiId ? item : { ...item, pins: Math.max(0, item.pins - delta) }
        ));
      }
    } finally {
      perSentiPinInFlight.current[sentiId] = false;
    }
  }, [onRequireAuth]);

  // ── View lock ─────────────────────────────────
  const handleViewLocked = useCallback(async (sentiId) => {
    if (!sessionRef.current?.user?.id) return;
    const uid = sessionRef.current.user.id;
    setUserViewLocks((prev) => ({ ...prev, [sentiId]: true }));
    const { error } = await supabase
      .from('senti_view_locks')
      .upsert(
        { senti_id: sentiId, user_id: uid },
        { onConflict: 'senti_id,user_id', ignoreDuplicates: true }
      );
    if (error) console.error('handleViewLocked error', error);
  }, []);

  // ── Render ────────────────────────────────────
  if (loading) {
    return <FeedSkeleton />;
  }

  if (sentis.length === 0) {
    if (loadError) {
      return (
        <View style={st.empty}>
          <Text style={st.emptyText}>Couldn't reach the Sentarium.{'\n'}Check your connection.</Text>
          <TouchableOpacity style={st.retryBtn} onPress={fetchSentis} activeOpacity={0.7}>
            <Text style={st.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <EmptyState
        icon="🌊"
        headline="The Sentarium is quiet"
        subtext="Be the first citizen to float a senti into the waves"
        style={{ backgroundColor: C.bg }}
      />
    );
  }

  const itemHeight = listHeight > 0 ? listHeight : SCREEN_HEIGHT;

  return (
    <View style={st.screen}>
      <StatusBar
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={C.bg}
      />
      <FlatList
        ref={flatListRef}
        data={sentis}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(data, index) => ({ length: itemHeight, offset: itemHeight * index, index })}
        onScrollToIndexFailed={() => {}}
        removeClippedSubviews
        windowSize={5}
        maxToRenderPerBatch={3}
        initialNumToRender={2}
        onLayout={(e) => setListHeight(e.nativeEvent.layout.height)}
        ListFooterComponent={
          loadingMore
            ? <View style={[st.loader, { height: itemHeight }]}>
                <ActivityIndicator color={C.accent} />
              </View>
            : null
        }
        renderItem={({ item }) => (
          <View style={{ height: itemHeight, backgroundColor: C.bg }}>
            <SentiCard
              senti={item}
              onVote={handleVote}
              onLike={handleLike}
              onVoice={handleVoice}
              onPin={handlePin}
              onAsk={handleAsk}
              onShareToDM={onShareSentiToDM}
              onFlag={handleFlag}
              onAvatarPress={
                // Guests may view profiles — no auth gate here (follow inside
                // ProfileScreen is a no-op without a session)
                item.creator?.userId
                  ? () => onNavigateToUser?.(item.creator.userId)
                  : undefined
              }
              onViewLocked={() => handleViewLocked(item.id)}
              liked={likedSentis[item.id]  ?? false}
              pinned={pinnedSentis[item.id] ?? false}
              userVote={userVotes[item.id] ?? null}
              userViewedReacts={userViewLocks[item.id] ?? false}
            />
          </View>
        )}
      />
      {/* Voice sheet — opens on chat button tap */}
      <VoiceSheet
        visible={!!voiceSentiId}
        onClose={() => setVoiceSentiId(null)}
        sentiId={voiceSentiId}
        session={session}
        onVoicePosted={() => handleVoicePosted(voiceSentiId)}
      />

      {/* Report sheet — opens on Flag button tap */}
      <ReportSheet
        visible={!!reportSentiId}
        submitting={reportBusy}
        onClose={() => setReportSentiId(null)}
        onSubmit={submitReport}
      />

      {/* Off-screen share card — rendered (not display:none) so view-shot can
          capture it, positioned far off-screen so it's never visible. */}
      {shareSenti && (
        <View
          style={{ position: 'absolute', left: -9999, top: 0 }}
          pointerEvents="none"
        >
          <ShareCard ref={shareCardRef} senti={shareSenti} />
        </View>
      )}
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0,
  },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  empty:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, paddingHorizontal: ms(32) },
  emptyText: { fontSize: fs(16), fontFamily: F.semiBold, color: C.textMuted, textAlign: 'center', lineHeight: fs(24) },
  retryBtn:  { marginTop: vs(16), paddingVertical: vs(10), paddingHorizontal: ms(28), borderRadius: ms(20), backgroundColor: C.accent },
  retryText: { fontSize: fs(15), fontFamily: F.bold, color: '#FFFFFF' },
});
