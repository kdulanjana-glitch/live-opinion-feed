// ─────────────────────────────────────────────
// Peolia — FloatScreen
// src/screens/FloatScreen.jsx
//
// Create a new senti. Includes draft form,
// wave picker, image/track buttons, and preview mode.
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, useColorScheme, Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { getPeoliaColors } from '../constants/peoliaTheme';

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
  const [wave,        setWave]         = useState('Tech');
  const [preview,     setPreview]      = useState(false);
  const [floating,    setFloating]     = useState(false);

  const canFloat = question.trim().length > 0 && wave;

  const handleFloat = async () => {
    if (!canFloat) return;
    setFloating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Sign in required', 'You need to sign in to float a senti.');
        return;
      }

      const { error } = await supabase.from('sentis').insert({
        question:    question.trim(),
        description: description.trim(),
        wave,
        user_id:     user.id,
        status:      'approved', // TODO: add moderation flow
        created_at:  new Date().toISOString(),
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
    return <FloatPreview
      question={question}
      description={description}
      wave={wave}
      onBack={() => setPreview(false)}
      onFloat={handleFloat}
      floating={floating}
      C={C}
    />;
  }

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backIcon}>←</Text>
          <Text style={s.headerTitle}>Float a senti</Text>
        </TouchableOpacity>
        <View style={s.headerRight}>
          <TouchableOpacity
            style={s.previewBtn}
            onPress={() => setPreview(true)}
            activeOpacity={0.7}
          >
            <Text style={s.previewText}>Preview</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.floatBtn, !canFloat && s.floatBtnDisabled]}
            onPress={handleFloat}
            disabled={!canFloat || floating}
            activeOpacity={0.7}
          >
            <Text style={s.floatBtnText}>
              {floating ? '...' : 'Float'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Senti input */}
        <View style={s.field}>
          <View style={s.fieldHeader}>
            <Text style={s.fieldLabel}>Senti</Text>
            <Text style={[
              s.charCount,
              question.length > SENTI_LIMIT * 0.9 && s.charCountWarn,
            ]}>
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
          />
        </View>

        {/* Description input */}
        <View style={s.field}>
          <View style={s.fieldHeader}>
            <Text style={s.fieldLabel}>Description</Text>
            <Text style={[
              s.charCount,
              description.length > DESC_LIMIT * 0.9 && s.charCountWarn,
            ]}>
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
                  <Text style={[
                    s.wavePillText,
                    { color: isActive ? '#FFFFFF' : C.textMuted },
                  ]}>
                    {WAVE_EMOJIS[w]} {w}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Media row */}
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
function FloatPreview({ question, description, wave, onBack, onFloat, floating, C }) {
  const s = makeStyles(C);
  const emoji = WAVE_EMOJIS[wave] ?? '🌊';

  return (
    <View style={s.screen}>
      {/* Header */}
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

      {/* Full bleed preview card */}
      <View style={[s.previewCard, { backgroundColor: '#1E1B4B' }]}>
        <View style={s.previewOverlay} />

        {/* Wave pill */}
        <View style={s.previewWavePill}>
          <Text style={s.previewWaveText}>{emoji} {wave.toUpperCase()} WAVE</Text>
        </View>

        {/* Question */}
        <Text style={s.previewQuestion}>{question}</Text>

        {/* Description */}
        {!!description && (
          <Text style={s.previewDesc} numberOfLines={4}>{description}</Text>
        )}

        {/* Vote buttons on image */}
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  backIcon: {
    fontSize: 15,
    color: C.textPrimary,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textPrimary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  previewBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: C.surfaceAlt,
    borderWidth: 0.5,
    borderColor: C.border,
  },
  previewText: {
    fontSize: 9,
    fontWeight: '700',
    color: C.textSecondary,
  },
  floatBtn: {
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: C.accent,
  },
  floatBtnDisabled: {
    opacity: 0.5,
  },
  floatBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scroll: {
    flex: 1,
  },
  field: {
    paddingHorizontal: 14,
    paddingTop: 10,
    gap: 3,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  fieldLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: C.textSecondary,
  },
  charCount: {
    fontSize: 8,
    fontWeight: '600',
    color: C.textMuted,
  },
  charCountWarn: {
    color: '#DC2626',
  },
  input: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 10.5,
    lineHeight: 15,
    color: C.textPrimary,
    textAlignVertical: 'top',
  },
  inputSenti: {
    minHeight: 58,
  },
  inputDesc: {
    minHeight: 60,
  },
  waveScroll: {
    flexGrow: 0,
  },
  waveContent: {
    gap: 6,
    paddingBottom: 2,
  },
  wavePill: {
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  wavePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  mediaRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 20,
  },
  mediaBtn: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 0.5,
  },
  mediaBtnIcon: {
    fontSize: 18,
  },
  mediaBtnLabel: {
    fontSize: 8,
    fontWeight: '600',
  },

  // Preview styles
  previewCard: {
    flex: 1,
    position: 'relative',
    padding: 14,
    justifyContent: 'center',
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  previewWavePill: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    marginBottom: 10,
    position: 'relative',
    zIndex: 1,
  },
  previewWaveText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  previewQuestion: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 22,
    marginBottom: 8,
    position: 'relative',
    zIndex: 1,
  },
  previewDesc: {
    fontSize: 10.5,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.72)',
    position: 'relative',
    zIndex: 1,
  },
  previewVoteBar: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 20,
    position: 'relative',
    zIndex: 1,
  },
  previewVoteBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  previewVoteEmoji: {
    fontSize: 26,
  },
});
