// ─────────────────────────────────────────────
// Peolia — FloatScreen
// src/screens/FloatScreen.jsx
//
// Inserts to: public.sentis
//   question   — the opinion text
//   description — optional context
//   wave        — capitalized category string ('Tech', 'Love', etc.)
//   user_id     — auth.uid()
//   image_url   — public URL in senti-images bucket (optional)
//   (status is never sent — DB column default owns it)
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, useColorScheme, Alert, StatusBar, Platform, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import WaveImageSheet from '../components/WaveImageSheet';
import { getPeoliaColors } from '../constants/peoliaTheme';
import { fs as fsBase, ms, vs } from '../utils/peoliaScale';

// FloatScreen text + icons run 50% larger than the rest of the app (user request).
// Every fs() in this file's styles routes through this scaled wrapper.
const fs = (n) => fsBase(Math.round(n * 1.5));

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
  // image holds either a picked gallery asset { uri, mimeType } or a preset
  // { uri, isPreset: true }. Presets are already-hosted URLs — no upload needed.
  const [image,        setImage]        = useState(null);
  const [imageSheet,   setImageSheet]   = useState(false);
  const [preview,      setPreview]      = useState(false);
  const [floating,     setFloating]     = useState(false);

  const canFloat = question.trim().length > 0 && wave;

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to attach an image to your senti.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [9, 16],        // full-bleed card background — crop to portrait
      quality: 0.8,
      base64: true,           // needed for upload (RN can't read the file via fetch)
    });
    if (!result.canceled) setImage(result.assets[0]);
  };

  // GIF picker — no crop (keep the animation) so the file uploads as image/gif
  const pickGif = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to attach a GIF.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],   // GIFs live under images
      allowsEditing: false,     // cropping would flatten the animation
      quality: 1,
      base64: true,
    });
    if (!result.canceled) setImage(result.assets[0]);
  };

  // Upload a picked gallery asset to senti-images/{userId}/... and return the public URL.
  // Decode the picker's base64 → ArrayBuffer. NOTE: fetch(localUri).arrayBuffer() does
  // NOT work in React Native — it yields a ~14-byte stub, not the real file bytes.
  const uploadImage = async (userId) => {
    if (!image?.base64) throw new Error('No image data to upload');
    const ext  = (image.uri.split('.').pop() || 'jpg').toLowerCase();
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('senti-images')
      .upload(path, decode(image.base64), { contentType: image.mimeType ?? 'image/jpeg' });
    if (error) throw error;
    return supabase.storage.from('senti-images').getPublicUrl(path).data.publicUrl;
  };

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

      // Presets are already hosted → use the URL directly. Gallery picks upload
      // first (abort the float on upload failure so the user can retry).
      const imageUrl = image
        ? (image.isPreset ? image.uri : await uploadImage(user.id))
        : null;

      // Insert into public.sentis (new schema)
      // status is NOT sent — the DB column default controls it so the client
      // can never bypass moderation. Requires: ALTER COLUMN status SET DEFAULT 'approved'
      const { error } = await supabase.from('sentis').insert({
        question:    question.trim(),
        description: description.trim() || null,
        wave,                   // capitalized: 'Tech', 'Love', etc.
        user_id:     user.id,   // sentis.user_id (not created_by)
        image_url:   imageUrl,
      });

      if (error) throw error;

      Alert.alert('Floating! 🌊', 'Your senti is floating. The world will react.');
      setQuestion('');
      setDescription('');
      setWave('Tech');
      setImage(null);
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
        image={image}
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

        {/* Media row — Image | GIF | Track */}
        <View style={s.mediaRow}>
          {image ? (
            <View style={s.imageThumbWrap}>
              <Image source={{ uri: image.uri }} style={s.imageThumb} resizeMode="cover" />
              <TouchableOpacity style={s.imageRemoveBtn} onPress={() => setImage(null)} activeOpacity={0.7}>
                <Text style={s.imageRemoveText}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={[s.mediaBtn, { backgroundColor: C.surfaceAlt, borderColor: C.border }]}
                activeOpacity={0.7}
                onPress={() => setImageSheet(true)}
              >
                <Text style={s.mediaBtnIcon}>🖼️</Text>
                <Text style={[s.mediaBtnLabel, { color: C.textSecondary }]}>Image</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.mediaBtn, { backgroundColor: C.surfaceAlt, borderColor: C.border }]}
                activeOpacity={0.7}
                onPress={pickGif}
              >
                <Text style={s.mediaBtnIcon}>🎞️</Text>
                <Text style={[s.mediaBtnLabel, { color: C.textSecondary }]}>GIF</Text>
              </TouchableOpacity>
            </>
          )}
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

      <WaveImageSheet
        visible={imageSheet}
        onClose={() => setImageSheet(false)}
        onSelectPreset={(url) => {
          setImage({ uri: url, isPreset: true });
          setImageSheet(false);
        }}
        onPickGallery={() => {
          // Dismiss the sheet before launching the OS gallery (avoids a modal-over-intent flash)
          setImageSheet(false);
          pickImage();
        }}
      />
    </View>
  );
}

// ── Preview sub-screen ─────────────────────────
function FloatPreview({ question, description, wave, image, onBack, onFloat, floating, C, s }) {
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
        {image && (
          <Image source={{ uri: image.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        )}
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
  // Default box heights: ~3 lines (senti), ~4 lines (description). Derived from the
  // input line height (fs(21)) + vertical padding (vs(10)*2) so they track the font size.
  inputSenti: { minHeight: fs(21) * 3 + vs(20) },
  inputDesc:  { minHeight: fs(21) * 4 + vs(20) },
  waveScroll:   { flexGrow: 0 },
  waveContent:  { gap: ms(8), paddingBottom: vs(4) },
  // Wave pills ~15% smaller
  wavePill:     { paddingVertical: vs(5), paddingHorizontal: ms(14), borderRadius: ms(18) },
  wavePillText: { fontSize: fs(12), fontWeight: '700' },
  mediaRow: {
    flexDirection: 'row', gap: ms(12),
    paddingHorizontal: ms(16), paddingTop: vs(12), paddingBottom: vs(24),
  },
  // Media buttons ~10% smaller
  mediaBtn: {
    flexDirection: 'column', alignItems: 'center', gap: vs(4),
    paddingVertical: vs(9), paddingHorizontal: ms(14),
    borderRadius: ms(11), borderWidth: 0.5,
  },
  mediaBtnIcon:  { fontSize: fs(22) },
  mediaBtnLabel: { fontSize: fs(12), fontWeight: '600' },
  imageThumbWrap: { position: 'relative' },
  imageThumb: {
    width: ms(72), height: ms(128),                               // 9:16, matches crop aspect
    borderRadius: ms(12), borderWidth: 0.5, borderColor: C.border,
  },
  imageRemoveBtn: {
    position: 'absolute', top: ms(-6), right: ms(-6),
    width: ms(24), height: ms(24), borderRadius: ms(12),
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center', justifyContent: 'center',
  },
  imageRemoveText: { fontSize: fs(12), fontWeight: '700', color: '#FFFFFF' },
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
