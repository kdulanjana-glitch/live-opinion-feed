// ─────────────────────────────────────────────
// Peolia — VoiceSheet
// src/components/VoiceSheet.jsx
//
// Bottom sheet for voices (comments) on a senti.
// Table: public.voices — id, senti_id, user_id, body, created_at
//                        joined with users(username)
// ─────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, KeyboardAvoidingView, Platform, ScrollView,
  useColorScheme, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { getPeoliaColors } from '../constants/peoliaTheme';
import { fs, ms, vs, s, SCREEN_HEIGHT } from '../utils/peoliaScale';

export default function VoiceSheet({ visible, onClose, sentiId, session, onVoicePosted }) {
  const scheme = useColorScheme();
  const C  = getPeoliaColors(scheme);
  const st = makeStyles(C);
  const insets = useSafeAreaInsets();

  const [voices,     setVoices]     = useState([]);
  const [text,       setText]       = useState('');
  const [loading,    setLoading]    = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible && sentiId) fetchVoices();
    if (!visible) setText('');
  }, [visible, sentiId]);

  const fetchVoices = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('voices')
      .select('id, body, created_at, users(username)')
      .eq('senti_id', sentiId)
      .order('created_at', { ascending: false })
      .limit(50);
    setVoices(data ?? []);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!text.trim() || !session?.user?.id || submitting) return;
    setSubmitting(true);
    const { error } = await supabase.from('voices').insert({
      senti_id: sentiId,
      user_id:  session.user.id,
      body:     text.trim(),
    });
    if (!error) {
      setText('');
      await fetchVoices();
      onVoicePosted?.();
    }
    setSubmitting(false);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={st.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ width: '100%' }}
        >
          <View style={[st.sheet, { backgroundColor: C.sheetBg, borderColor: C.sheetBorder, paddingBottom: vs(20) + insets.bottom }]}>

            {/* Handle */}
            <View style={[st.handle, { backgroundColor: C.border }]} />

            {/* Header */}
            <View style={st.header}>
              <Text style={[st.title, { color: C.textPrimary }]}>Voices</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={[st.closeBtn, { color: C.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* List */}
            {loading ? (
              <ActivityIndicator color={C.accent} style={{ marginVertical: vs(24) }} />
            ) : voices.length === 0 ? (
              <Text style={[st.empty, { color: C.textMuted }]}>
                No voices yet. Be the first to speak up.
              </Text>
            ) : (
              <ScrollView
                style={st.list}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {voices.map((v) => (
                  <View key={v.id} style={st.row}>
                    <View style={[st.avatar, { backgroundColor: C.accentLight, borderColor: C.accentMid }]}>
                      <Text style={[st.avatarText, { color: C.accent }]}>
                        {(v.users?.username || '?')[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={st.rowBody}>
                      <Text style={[st.username, { color: C.textSecondary }]}>
                        @{v.users?.username ?? 'anonymous'}
                      </Text>
                      <Text style={[st.voiceText, { color: C.textPrimary }]}>{v.body}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Input row */}
            <View style={[st.inputRow, { borderTopColor: C.border }]}>
              <TextInput
                style={[st.input, { backgroundColor: C.surfaceAlt, borderColor: C.border, color: C.textPrimary }]}
                placeholder="Add your voice..."
                placeholderTextColor={C.textMuted}
                value={text}
                onChangeText={setText}
                maxLength={500}
                multiline={false}
                returnKeyType="send"
                onSubmitEditing={handleSubmit}
              />
              <TouchableOpacity
                style={[st.sendBtn, { backgroundColor: text.trim() ? C.accent : C.surfaceAlt }]}
                onPress={handleSubmit}
                disabled={submitting || !text.trim()}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: text.trim() ? '#FFFFFF' : C.textMuted, fontSize: fs(18) }}>↑</Text>
                )}
              </TouchableOpacity>
            </View>

          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const makeStyles = (C) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: ms(20),
    borderTopRightRadius: ms(20),
    borderTopWidth: 0.5,
    paddingHorizontal: ms(16),
    maxHeight: SCREEN_HEIGHT * 0.72,
  },
  handle: {
    width: ms(36),
    height: vs(4),
    borderRadius: ms(2),
    alignSelf: 'center',
    marginTop: vs(10),
    marginBottom: vs(14),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(14),
  },
  title:    { fontSize: fs(17), fontWeight: '700' },
  closeBtn: { fontSize: fs(18), padding: ms(4) },
  empty: {
    textAlign: 'center',
    fontSize: fs(14),
    paddingVertical: vs(24),
  },
  list: { maxHeight: SCREEN_HEIGHT * 0.36 },
  row: {
    flexDirection: 'row',
    gap: ms(10),
    marginBottom: vs(16),
    alignItems: 'flex-start',
  },
  avatar: {
    width: s(34),
    height: s(34),
    borderRadius: s(17),
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: fs(13), fontWeight: '700' },
  rowBody:    { flex: 1, gap: vs(2) },
  username:   { fontSize: fs(12), fontWeight: '600' },
  voiceText:  { fontSize: fs(14), lineHeight: fs(20) },
  inputRow: {
    flexDirection: 'row',
    gap: ms(10),
    borderTopWidth: 0.5,
    paddingTop: vs(12),
    marginTop: vs(8),
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: ms(22),
    paddingHorizontal: ms(16),
    paddingVertical: vs(10),
    fontSize: fs(14),
  },
  sendBtn: {
    width: s(42),
    height: s(42),
    borderRadius: s(21),
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
