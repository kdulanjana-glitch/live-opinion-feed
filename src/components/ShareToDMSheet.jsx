// ─────────────────────────────────────────────
// Peolia — ShareToDMSheet
// src/components/ShareToDMSheet.jsx
//
// Bottom-sheet recipient picker for sharing a senti into a DM. Pick a citizen
// (search, or suggested = people you follow) → finds/creates the conversation,
// inserts a senti message, and calls onShared(userId) so the host can open the DM.
//
// Props: visible, sentiId, onClose, onShared(userId)
// ─────────────────────────────────────────────

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Image,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { PeoliaFonts as F , getPeoliaColors } from '../constants/peoliaTheme';
import { usePeoliaScheme } from '../context/ThemeContext';
import { useBlocks } from '../context/BlockContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import { supabase } from '../lib/supabase';

import { fs, ms, vs, s } from '../utils/peoliaScale';
import { getOrCreateDMConversation, sendSentiToDM, dmInitials } from '../lib/dmUtils';

const AVATAR_COLORS = ['#4F46E5', '#059669', '#D97706', '#7C3AED'];
const avatarColor = (id) => {
  if (!id) return AVATAR_COLORS[0];
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h + id.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
};

export default function ShareToDMSheet({ visible, sentiId, onClose, onShared }) {
  const scheme = usePeoliaScheme();
  const C  = getPeoliaColors(scheme);
  const st = makeStyles(C);
  const insets = useSafeAreaInsets();
  const { hiddenIds } = useBlocks();

  const [currentUserId, setCurrentUserId] = useState(null);
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState(null);
  const debounceRef = useRef(null);

  const runSearch = useCallback(async (q, uid) => {
    if (!uid) { setResults([]); return; }
    setLoading(true);
    if (!q || q.length < 2) {
      const { data: follows } = await supabase
        .from('follows').select('following_id').eq('follower_id', uid).limit(20);
      const ids = (follows ?? []).map((f) => f.following_id);
      if (!ids.length) { setResults([]); setLoading(false); return; }
      const { data: users } = await supabase
        .from('users').select('id, display_name, username, avatar_initials, avatar_url').in('id', ids);
      setResults((users ?? []).filter((u) => !hiddenIds.includes(u.id)));
    } else {
      const { data } = await supabase
        .from('users')
        .select('id, display_name, username, avatar_initials, avatar_url')
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(20);
      setResults((data ?? []).filter((u) => u.id !== uid && !hiddenIds.includes(u.id)));
    }
    setLoading(false);
  }, [hiddenIds]);

  // On open: resolve user + load suggested
  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setResults([]);
    setSendingId(null);
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id ?? null;
      setCurrentUserId(uid);
      runSearch('', uid);
    })();
  }, [visible, runSearch]);

  const handleSearch = (text) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(text.trim(), currentUserId), 300);
  };

  const handlePick = async (userId) => {
    if (!currentUserId || !sentiId || sendingId) return;
    setSendingId(userId);
    try {
      const convId = await getOrCreateDMConversation(supabase, currentUserId, userId);
      await sendSentiToDM(supabase, convId, currentUserId, sentiId);
      onShared?.(userId);
    } catch (err) {
      console.error('ShareToDMSheet send error', err);
      setSendingId(null);
    }
  };

  const renderCitizen = ({ item }) => {
    const name = item.display_name?.trim() || item.username || 'Citizen';
    return (
      <TouchableOpacity style={st.row} onPress={() => handlePick(item.id)} activeOpacity={0.7} disabled={!!sendingId}>
        <View style={[st.avatar, { backgroundColor: avatarColor(item.id) }]}>
          {item.avatar_url
            ? <Image source={{ uri: item.avatar_url }} style={st.avatarFill} resizeMode="cover" />
            : <Text style={st.avatarText}>{dmInitials(item)}</Text>}
        </View>
        <View style={st.mid}>
          <Text style={st.name} numberOfLines={1}>{name}</Text>
          <Text style={st.userHandle} numberOfLines={1}>@{item.username}</Text>
        </View>
        {sendingId === item.id
          ? <ActivityIndicator color={C.accent} size="small" />
          : <View style={st.sendPill}><Text style={st.sendPillText}>Send</Text></View>}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={st.backdrop}>
        <View style={[st.sheet, { paddingBottom: vs(12) + insets.bottom }]}>
          <View style={st.handle} />
          <View style={st.header}>
            <Text style={st.title}>Share to a message</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="ti-x" size={fs(20)} color={C.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={st.searchWrap}>
            <Icon name="ti-search" size={fs(16)} color={C.textMuted} />
            <TextInput
              style={st.searchInput}
              value={query}
              onChangeText={handleSearch}
              placeholder="Search citizens..."
              placeholderTextColor={C.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {query.length < 2 && <Text style={st.sectionLabel}>SUGGESTED</Text>}

          {loading ? (
            <View style={st.loader}><ActivityIndicator color={C.accent} /></View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              renderItem={renderCitizen}
              keyboardShouldPersistTaps="handled"
              style={st.list}
              ListEmptyComponent={
                <Text style={st.empty}>
                  {query.length >= 2 ? 'No citizens found' : 'Follow citizens to see suggestions'}
                </Text>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (C) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.sheetBg, maxHeight: '80%',
    borderTopLeftRadius: ms(20), borderTopRightRadius: ms(20),
    borderTopWidth: 0.5, borderColor: C.sheetBorder,
    paddingHorizontal: ms(16), paddingTop: vs(10),
  },
  handle: { width: ms(36), height: vs(4), borderRadius: ms(2), backgroundColor: C.border, alignSelf: 'center', marginBottom: vs(12) },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: vs(10) },
  title: { letterSpacing: -0.2, fontSize: fs(16), fontFamily: F.extraBold, color: C.textPrimary },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: ms(8),
    backgroundColor: C.surfaceAlt, borderWidth: 0.5, borderColor: C.border,
    borderRadius: ms(12), paddingHorizontal: ms(12), paddingVertical: vs(9),
  },
  searchInput: { fontFamily: F.regular, flex: 1, fontSize: fs(14), color: C.textPrimary, padding: 0 },
  sectionLabel: { fontSize: fs(11), fontFamily: F.extraBold, letterSpacing: 0.6, color: C.textMuted, marginTop: vs(12), marginBottom: vs(4) },
  loader: { paddingVertical: vs(28), alignItems: 'center' },
  list: { marginTop: vs(4) },
  empty: { fontFamily: F.regular, fontSize: fs(13), color: C.textMuted, textAlign: 'center', marginTop: vs(20) },

  row: { flexDirection: 'row', alignItems: 'center', gap: ms(10), paddingVertical: vs(9) },
  avatar: { width: s(40), height: s(40), borderRadius: s(20), alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarFill: { width: '100%', height: '100%' },
  avatarText: { letterSpacing: -0.2, fontSize: fs(16), fontFamily: F.extraBold, color: '#FFFFFF' },
  mid: { flex: 1 },
  name: { fontSize: fs(14), fontFamily: F.bold, color: C.textPrimary },
  userHandle: { fontFamily: F.regular, fontSize: fs(12), color: C.textMuted, marginTop: vs(1) },
  sendPill: { paddingVertical: vs(6), paddingHorizontal: ms(16), borderRadius: ms(20), backgroundColor: C.accent },
  sendPillText: { fontSize: fs(13), fontFamily: F.bold, color: '#FFFFFF' },
});
