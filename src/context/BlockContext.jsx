// ─────────────────────────────────────────────
// Peolia — BlockContext
// src/context/BlockContext.jsx
//
// Single source of truth for "users I can't see" (Google Play UGC: block).
//   • hiddenIds — UNION of users I blocked AND users who blocked me. Feed,
//     Trending and Profile filter their content against this set so blocking
//     is mutually invisible. Sourced from the get_blocked_ids() SECURITY
//     DEFINER RPC (so the "blocked me" direction works without exposing rows).
//   • iBlocked  — only the users *I* blocked. Drives the Block/Unblock toggle
//     on another citizen's profile.
//
// block()/unblock() go through the block_user/unblock_user RPCs (which also
// tear down follow edges) and update both sets optimistically.
// ─────────────────────────────────────────────

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const BlockContext = createContext(null);

export function BlockProvider({ children }) {
  const [currentUserId, setCurrentUserId] = useState(null);
  const [hiddenIds, setHiddenIds] = useState([]);   // union (filtering)
  const [iBlocked,  setIBlocked]  = useState([]);   // users I blocked (toggle)

  const refresh = useCallback(async (uid) => {
    if (!uid) { setHiddenIds([]); setIBlocked([]); return; }
    const [hiddenRes, mineRes] = await Promise.all([
      supabase.rpc('get_blocked_ids'),
      supabase.from('user_blocks').select('blocked_id').eq('blocker_id', uid),
    ]);
    setHiddenIds((hiddenRes.data ?? []).map((r) => r.user_id));
    setIBlocked((mineRes.data ?? []).map((r) => r.blocked_id));
  }, []);

  // ── Identify current user (mount + auth changes) ──
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      const uid = user?.id ?? null;
      setCurrentUserId(uid);
      refresh(uid);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      setCurrentUserId(uid);
      refresh(uid);
    });

    return () => subscription.unsubscribe();
  }, [refresh]);

  const isBlocked = useCallback((userId) => iBlocked.includes(userId), [iBlocked]);

  const block = useCallback(async (target) => {
    if (!target || !currentUserId || target === currentUserId) return false;
    // Optimistic
    setHiddenIds((prev) => (prev.includes(target) ? prev : [...prev, target]));
    setIBlocked((prev) => (prev.includes(target) ? prev : [...prev, target]));
    const { error } = await supabase.rpc('block_user', { target });
    if (error) {
      console.error('block_user error', error);
      // Rollback — but only drop from iBlocked; they might still block me.
      setIBlocked((prev) => prev.filter((id) => id !== target));
      setHiddenIds((prev) => prev.filter((id) => id !== target));
      return false;
    }
    return true;
  }, [currentUserId]);

  const unblock = useCallback(async (target) => {
    if (!target || !currentUserId) return false;
    const prevHidden = hiddenIds;
    const prevMine   = iBlocked;
    setIBlocked((prev) => prev.filter((id) => id !== target));
    setHiddenIds((prev) => prev.filter((id) => id !== target));
    const { error } = await supabase.rpc('unblock_user', { target });
    if (error) {
      console.error('unblock_user error', error);
      setIBlocked(prevMine);
      setHiddenIds(prevHidden);
      return false;
    }
    // Reconcile — target may still be blocking me, which keeps them hidden.
    refresh(currentUserId);
    return true;
  }, [currentUserId, hiddenIds, iBlocked, refresh]);

  return (
    <BlockContext.Provider
      value={{ hiddenIds, isBlocked, block, unblock, refreshBlocks: () => refresh(currentUserId) }}
    >
      {children}
    </BlockContext.Provider>
  );
}

export function useBlocks() {
  const ctx = useContext(BlockContext);
  return ctx ?? {
    hiddenIds: [],
    isBlocked: () => false,
    block: async () => false,
    unblock: async () => false,
    refreshBlocks: () => {},
  };
}
