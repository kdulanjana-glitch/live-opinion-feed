import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const PinsContext = createContext(null);

export function PinsProvider({ children }) {
  const [currentUserId, setCurrentUserId] = useState(null);
  const [pinnedIds, setPinnedIds] = useState([]);

  const refresh = useCallback(async (uid) => {
    if (!uid) { setPinnedIds([]); return; }
    const { data } = await supabase.from('senti_pins').select('senti_id').eq('user_id', uid);
    setPinnedIds((data ?? []).map((r) => r.senti_id));
  }, []);

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

  const isPinned = useCallback((sentiId) => pinnedIds.includes(sentiId), [pinnedIds]);

  const pin = useCallback(async (sentiId) => {
    if (!sentiId || !currentUserId) return false;
    setPinnedIds((prev) => (prev.includes(sentiId) ? prev : [...prev, sentiId]));
    const { error } = await supabase.from('senti_pins').insert({ senti_id: sentiId, user_id: currentUserId });
    if (error) {
      console.error('pin error', error);
      setPinnedIds((prev) => prev.filter((id) => id !== sentiId));
      return false;
    }
    return true;
  }, [currentUserId]);

  const unpin = useCallback(async (sentiId) => {
    if (!sentiId || !currentUserId) return false;
    const prevIds = pinnedIds;
    setPinnedIds((p) => p.filter((id) => id !== sentiId));
    const { error } = await supabase.from('senti_pins').delete()
      .eq('user_id', currentUserId).eq('senti_id', sentiId);
    if (error) {
      console.error('unpin error', error);
      setPinnedIds(prevIds);
      return false;
    }
    return true;
  }, [currentUserId, pinnedIds]);

  return (
    <PinsContext.Provider value={{ pinnedIds, isPinned, pin, unpin, refreshPins: () => refresh(currentUserId) }}>
      {children}
    </PinsContext.Provider>
  );
}

export function usePins() {
  const ctx = useContext(PinsContext);
  return ctx ?? { pinnedIds: [], isPinned: () => false, pin: async () => false, unpin: async () => false, refreshPins: () => {} };
}
