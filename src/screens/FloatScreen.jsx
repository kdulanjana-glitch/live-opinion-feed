// ─────────────────────────────────────────────
// Peolia — FloatScreen
// src/screens/FloatScreen.jsx
//
// Inserts to: public.sentis
//   question   — the opinion text
//   description — optional context
//   wave        — capitalized category string ('Tech', 'Love', etc.)
//   user_id     — auth.uid()
//   status      — 'approved'
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, useColorScheme, Alert, StatusBar, Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { getPeoliaColors } from '../constants/peoliaTheme';
import { fs, ms, vs } from '../utils/peoliaScale';

const SENTI_LIMIT = 150;
const DESC_LIMIT  = 300;

const ALL_WAVES = [
  'Tech', 'Love', 'Money', 'Life', 'Society',
  'Politics', 'Food', 'Health', 'Sports',
  'Entertainment', 'Science', 'Education', 'Environment',
];

const WAVE_EMOJIS = {
  'Tech': '💻', 'Love': '❤️', 'Money': '💰', 'Life': '🌱',
  'Society': '🌍', 'Politics': '🏛️', 'Food': '🍕', 'Health': '💪',
  'Sports': '⚽', 'Entertainment': '🎬', 'Science': '🔬',
  'Education': '📚', 'Environment': '🌿',
};

export default function FloatScreen({ onBack, onFloated }) {
  const scheme = useColorScheme();
  const C = getPeoliaColors(scheme);
  const s = makeStyles(C);

  const [question,    setQuestion]    = useState('');
  const [description, setDescription] = useState('');
  const [wave,        setWave]        = useState('Tech');
  const [preview,     setPreview]     = useState(false);
  const [floating,    setFloating]    = useState(false);

  const canFloat = question.trim().length > 0 && wave;

  const handleFloat = async () => {
    if (!canFloat) return;
    setFloating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Sign in required', 'You need to sign in to float a senti.');
        setFloating(false);
        return;
      }

      // Insert into public.sentis (new schema)
      // status is NOT sent — the DB column default controls it so the client
      // can never bypass moderation. Requires: ALTER COLUMN status SET DEFAULT 'approved'
      const { error } = await supabase.from('sentis').insert({
        question:    question.trim(),
        description: description.trim() || null,
        wave,                   // capitalized: 'Tech', 'Love', etc.
        user_id:     user.id,   // sentis.user_id (not created_by)
      });

      if (error) throw error;

      Alert.alert('Floating! 🌊', 'Your senti is floating. The world will react.');
      setQuestion('');
      setDescription('');
      setWave('Tech');
      setPreview(false);
      onFloated?.();
      onBack?.();
    } catch (err) {
      console.error('FloatScreen handleFloat error', err);
      Alert.alert('Error', 'Could not float your senti. Please try again.');
    } finally {
      setFloating(false);
    }
  };

  if (preview) {
    return (
      <FloatPreview
        question={question}
        description={description}
        wave={wave}
        onBack={() => setPreview(false)}
        onFloat={handleFloat}
        floating={floating}
        C={C}
        s={s}
      />
    );
  }

  return (
    <View style={s.screen}>
      <StatusBar
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={C.bg}
      />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backIcon}>←</Text>
          <Text style={s.headerTitle}>Float a senti</Text>
        </TouchableOpacity>
        <View style={s.headerRight}>
          <TouchableOpacity style={s.previewBtn} onPress={() => setPreview(true)} activeOpacity={0.7}>
            <Text style={s.previewText}>Preview</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.floatBtn, !canFloat && s.floatBtnDisabled]}
            onPress={handleFloat}
            disabled={!canFloat || floating}
            activeOpacity={0.7}
          >
            <Text style={s.floatBtnText}>{floating ? '...' : 'Float'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Question input */}
        <View style={s.field}>
          <View style={s.fieldHeader}>
            <Text style={s.fieldLabel}>Senti</Text>
            <Text style={[s.charCount, question.length > SENTI_LIMIT * 0.9 && s.charCountWarn]}>
              {question.length} / {SENTI_LIMIT}
            </Text>
          </View>
          <TextInput
            style={[s.input, s.inputSenti]}
            value={question}
            onChangeText={(t) => t.length <= SENTI_LIMIT && setQuestion(t)}
            placeholder="What's on your mind? Float it into the Sentarium."
            placeholderTextColor={C.textMuted}
            multiline
            maxLength={SENTI_LIMIT}
            textAlignVertical="top"
          />
        </View>

        {/* Description input */}
        <View style={s.field}>
          <View style={s.fieldHeader}>
            <Text style={s.fieldLabel}>Description</Text>
            <Text style={[s.charCount, description.length > DESC_LIMIT * 0.9 && s.charCountWarn]}>
              {description.length} / {DESC_LIMIT}
            </Text>
          </View>
          <TextInput
            style={[s.input, s.inputDesc]}
            value={description}
            onChangeText={(t) => t.length <= DESC_LIMIT && setDescription(t)}
            placeholder="Give citizens some context..."
            placeholderTextColor={C.textMuted}
            multiline
            maxLength={DESC_LIMIT}
            textAlignVertical="top"
          />
        </View>

        {/* Wave picker */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Wave</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.waveScroll}
            contentContainerStyle={s.waveContent}
          >
            {ALL_WAVES.map((w) => {
              const isActive = wave === w;
              return (
                <TouchableOpacity
                  key={w}
                  style={[
                    s.wavePill,
                    isActive
                      ? { backgroundColor: C.accent }
                      : { backgroundColor: C.surfaceAlt, borderWidth: 0.5, borderColor: C.border },
                  ]}
                  onPress={() => setWave(w)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.wavePillText, { color: isActive ? '#FFFFFF' : C.textMuted }]}>
                    {WAVE_EMOJIS[w]} {w}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Media row (stubs) */}
        <View style={s.mediaRow}>
          <TouchableOpacity
            style={[s.mediaBtn, { backgroundColor: C.surfaceAlt, borderColor: C.border }]}
            activeOpacity={0.7}
            onPress={() => Alert.alert('Coming soon', 'Image picker — Sprint 2')}
          >
            <Text style={s.mediaBtnIcon}>🖼️</Text>
            <Text style={[s.mediaBtnLabel, { color: C.textSecondary }]}>Wave image</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.mediaBtn, { backgroundColor: C.surfaceAlt, borderColor: C.border }]}
            activeOpacity={0.7}
            onPress={() => Alert.alert('Coming soon', 'Track feature — Sprint 3')}
          >
            <Text style={s.mediaBtnIcon}>🎵</Text>
            <Text style={[s.mediaBtnLabel, { color: C.textSecondary }]}>Track</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

// ── Preview sub-screen ─────────────────────────
function FloatPreview({ question, description, wave, onBack, onFloat, floating, C, s }) {
  const emoji = WAVE_EMOJIS[wave] ?? '🌊';
  return (
    <View style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backIcon}>←</Text>
          <Text style={s.headerTitle}>Preview</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.floatBtn, (!question || floating) && s.floatBtnDisabled]}
          onPress={onFloat}
          disabled={!question || floating}
          activeOpacity={0.7}
        >
          <Text style={s.floatBtnText}>{floating ? '...' : 'Float'}</Text>
        </TouchableOpacity>
      </View>
      <View style={[s.previewCard, { backgroundColor: '#1E1B4B' }]}>
        <View style={s.previewOverlay} />
        <View style={s.previewWavePill}>
          <Text style={s.previewWaveText}>{emoji} {wave.toUpperCase()} WAVE</Text>
        </View>
        <Text style={s.previewQuestion}>{question}</Text>
        {!!description && (
          <Text style={s.previewDesc} numberOfLines={4}>{description}</Text>
        )}
        <View style={s.previewVoteBar}>
          {['👍', '🤔', '👎'].map((e, i) => (
            <View key={i} style={s.previewVoteBtn}>
              <Text style={s.previewVoteEmoji}>{e}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: ms(16), paddingTop: vs(10), paddingBottom: vs(6),
  },
  backBtn:  { flexDirection: 'row', alignItems: 'center', gap: ms(6) },
  backIcon: { fontSize: fs(20), color: C.textPrimary },                 // was fs(18) ×1.10
  headerTitle: { fontSize: fs(17), fontWeight: '700', color: C.textPrimary }, // was fs(15) ×1.10
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: ms(6) },
  previewBtn: {
    paddingVertical: vs(5), paddingHorizontal: ms(12), borderRadius: ms(20),
    backgroundColor: C.surfaceAlt, borderWidth: 0.5, borderColor: C.border,
  },
  previewText: { fontSize: fs(14), fontWeight: '700', color: C.textSecondary }, // was fs(13) ×1.10
  floatBtn: { paddingVertical: vs(6), paddingHorizontal: ms(16), borderRadius: ms(20), backgroundColor: C.accent },
  floatBtnDisabled: { opacity: 0.5 },
  floatBtnText: { fontSize: fs(14), fontWeight: '700', color: '#FFFFFF' },      // was fs(13) ×1.10
  scroll: { flex: 1 },
  field: { paddingHorizontal: ms(16), paddingTop: vs(12), gap: vs(4) },
  fieldHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: vs(4),
  },
  fieldLabel:    { fontSize: fs(14), fontWeight: '700', color: C.textSecondary }, // was fs(13) ×1.10
  charCount:     { fontSize: fs(13), fontWeight: '600', color: C.textMuted },     // was fs(12) ×1.10
  charCountWarn: { color: '#DC2626' },
  input: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: ms(12), paddingHorizontal: ms(12), paddingVertical: vs(10),
    fontSize: fs(15), lineHeight: fs(21), color: C.textPrimary, textAlignVertical: 'top', // was fs(14) ×1.10
  },
  inputSenti: { minHeight: vs(70) },
  inputDesc:  { minHeight: vs(70) },
  waveScroll:   { flexGrow: 0 },
  waveContent:  { gap: ms(8), paddingBottom: vs(4) },
  wavePill:     { paddingVertical: vs(6), paddingHorizontal: ms(16), borderRadius: ms(20) },
  wavePillText: { fontSize: fs(14), fontWeight: '700' },          // was fs(13) ×1.10
  mediaRow: {
    flexDirection: 'row', gap: ms(12),
    paddingHorizontal: ms(16), paddingTop: vs(12), paddingBottom: vs(24),
  },
  mediaBtn: {
    flexDirection: 'column', alignItems: 'center', gap: vs(4),
    paddingVertical: vs(10), paddingHorizontal: ms(16),
    borderRadius: ms(12), borderWidth: 0.5,
  },
  mediaBtnIcon:  { fontSize: fs(24) },                            // was fs(22) ×1.10
  mediaBtnLabel: { fontSize: fs(13), fontWeight: '600' },         // was fs(12) ×1.10
  // Preview
  previewCard: { flex: 1, position: 'relative', padding: ms(16), justifyContent: 'center' },
  previewOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.48)' },
  previewWavePill: {
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: ms(20),
    paddingVertical: vs(4), paddingHorizontal: ms(14), alignSelf: 'flex-start',
    marginBottom: vs(12), position: 'relative', zIndex: 1,
  },
  previewWaveText:  { fontSize: fs(14), fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.4 }, // was fs(13) ×1.10
  previewQuestion:  { fontSize: fs(22), fontWeight: '800', color: '#FFFFFF', lineHeight: fs(27), marginBottom: vs(10), position: 'relative', zIndex: 1 }, // was fs(20) ×1.10
  previewDesc:      { fontSize: fs(15), lineHeight: fs(21), color: 'rgba(255,255,255,0.72)', position: 'relative', zIndex: 1 }, // was fs(14) ×1.10
  previewVoteBar:   { flexDirection: 'row', gap: ms(6), marginTop: vs(24), position: 'relative', zIndex: 1 },
  previewVoteBtn:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: vs(12), borderRadius: ms(14), backgroundColor: 'rgba(255,255,255,0.15)' },
  previewVoteEmoji: { fontSize: fs(33) },  // was fs(30) ×1.10
});
