// ─────────────────────────────────────────────
// Peolia — NotificationContext
// src/context/NotificationContext.jsx
//
// One realtime subscription for the whole app. One source of truth for the
// unread count. One toast queue. A registration slot so the root layout can
// plug in actual navigation behavior — deeply nested screens (e.g.
// NotificationListScreen) trigger navigation through here without prop-drilling.
// ─────────────────────────────────────────────

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [currentUserId, setCurrentUserId] = useState(null);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [toastQueue,    setToastQueue]    = useState([]);

  // A function registered by the root layout — NOT state (no re-render needed).
  const navigateHandlerRef = useRef(null);

  const fetchUnread = async (userId) => {
    if (!userId) { setUnreadCount(0); return; }
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    setUnreadCount(count ?? 0);
  };

  // ── Identify the current user (on mount + on auth changes) ──
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
      fetchUnread(user?.id ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      setCurrentUserId(uid);
      if (uid) fetchUnread(uid);
      else { setUnreadCount(0); setToastQueue([]); }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── One realtime subscription for new notifications ──
  useEffect(() => {
    if (!currentUserId) return;

    const enrichNotification = async (row) => {
      // Actor profile
      const { data: actor } = await supabase
        .from('users')
        .select('username, display_name, avatar_initials')
        .eq('id', row.actor_id)
        .single();

      // Related senti question (if any)
      let sentiQuestion = null;
      if (row.senti_id) {
        const { data: senti } = await supabase
          .from('sentis')
          .select('question')
          .eq('id', row.senti_id)
          .single();
        sentiQuestion = senti?.question ?? null;
      }

      // Reaction word (react notifications only)
      let reaction = null;
      if (row.type === 'react' && row.senti_id) {
        const { data: rx } = await supabase
          .from('senti_reactions')
          .select('reaction')
          .eq('senti_id', row.senti_id)
          .eq('user_id', row.actor_id)
          .single();
        reaction = rx?.reaction ?? null;
      }

      return { ...row, actor: actor ?? null, sentiQuestion, reaction };
    };

    const channel = supabase
      .channel(`notif-ctx-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUserId}` },
        async (payload) => {
          setUnreadCount((prev) => prev + 1);
          try {
            const enriched = await enrichNotification(payload.new);
            setToastQueue((prev) => [...prev, enriched]);
          } catch (err) {
            console.error('enrichNotification error', err);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUserId]);

  // ── Toast queue ──
  const currentToast = toastQueue[0] ?? null;
  const dismissCurrentToast = () => setToastQueue((prev) => prev.slice(1));

  // ── Navigation ──
  const registerNavigationHandler = (fn) => { navigateHandlerRef.current = fn; };

  const navigateToNotification = (notification) => {
    dismissCurrentToast();                 // always clear the toast on navigate
    navigateHandlerRef.current?.(notification);
  };

  // ── Read state ──
  const markAllRead = async () => {
    if (!currentUserId) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', currentUserId)
      .eq('is_read', false);
    setUnreadCount(0);
  };

  const refreshUnreadCount = () => fetchUnread(currentUserId);

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        currentToast,
        dismissCurrentToast,
        registerNavigationHandler,
        navigateToNotification,
        markAllRead,
        refreshUnreadCount,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  // Safe fallback if a consumer renders outside the provider (shouldn't happen).
  return ctx ?? {
    unreadCount: 0,
    currentToast: null,
    dismissCurrentToast: () => {},
    registerNavigationHandler: () => {},
    navigateToNotification: () => {},
    markAllRead: async () => {},
    refreshUnreadCount: () => {},
  };
}
