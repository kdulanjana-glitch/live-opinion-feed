// ─────────────────────────────────────────────
// Peolia — WaveImageSheet
// src/components/WaveImageSheet.jsx
//
// Bottom-sheet image picker for FloatScreen. Two sources:
//   1. Presets — images uploaded to the senti-images/presets/ folder in the
//      Supabase dashboard. Listed at runtime, no rebuild needed. Selecting one
//      passes its public URL straight through (no upload).
//   2. Photos — the device gallery (handled by the parent's pickImage()).
//
// To add presets: Supabase dashboard → Storage → senti-images → presets/ →
// upload jpg/png/webp. They appear here automatically.
// ─────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
  StyleSheet, Modal, useColorScheme, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { getPeoliaColors } from '../constants/peoliaTheme';
import { fs, ms, vs, SCREEN_WIDTH, SCREEN_HEIGHT } from '../utils/peoliaScale';

const PRESET_FOLDER = 'presets';
const GRID_COLS = 3;
const GRID_GAP  = ms(8);
const H_PAD     = ms(18);
const TILE_W    = Math.floor((SCREEN_WIDTH - H_PAD * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS);
const TILE_H    = Math.round(TILE_W * 1.4);   // portrait-ish — matches 9:16 full-bleed cards

export default function WaveImageSheet({ visible, onClose, onSelectPreset, onPickGallery }) {
  const scheme = useColorScheme();
  const C = getPeoliaColors(scheme);
  const st = makeStyles(C);
  const insets = useSafeAreaInsets();

  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch the presets/ folder each time the sheet opens (cheap; reflects new uploads)
  useEffect(() => {
    if (!visible) return;
    let active = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.storage
        .from('senti-images')
        .list(PRESET_FOLDER, { limit: 100, sortBy: { column: 'name', order: 'asc' } });
      if (!active) return;
      if (error) {
        console.error('WaveImageSheet list presets error', error);
        setPresets([]);
      } else {
        // Skip folders (id === null) and non-image files
        const urls = (data ?? [])
          .filter((f) => f.id && /\.(jpe?g|png|webp|gif)$/i.test(f.name))
          .map((f) =>
            supabase.storage.from('senti-images')
              .getPublicUrl(`${PRESET_FOLDER}/${f.name}`).data.publicUrl
          );
        setPresets(urls);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableOpacity style={st.backdrop} activeOpacity={1} onPress={onClose}>
        {/* activeOpacity=1 + stopPropagation via inner View — tap outside closes */}
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ width: '100%' }}>
          <View style={[st.sheet, { paddingBottom: vs(20) + insets.bottom }]}>
            <View style={st.handle} />

            <View style={st.headerRow}>
              <Text style={st.title}>Add a wave image</Text>
              <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
                <Text style={st.closeX}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Source: device gallery */}
            <TouchableOpacity style={st.galleryBtn} onPress={onPickGallery} activeOpacity={0.7}>
              <Text style={st.galleryIcon}>🖼️</Text>
              <Text style={st.galleryLabel}>Choose from Photos</Text>
              <Text style={st.galleryChevron}>›</Text>
            </TouchableOpacity>

            <Text style={st.sectionLabel}>Presets</Text>

            {loading ? (
              <View style={st.stateBox}>
                <ActivityIndicator color={C.accent} />
              </View>
            ) : presets.length === 0 ? (
              <View style={st.stateBox}>
                <Text style={st.emptyText}>
                  No presets yet. Upload images to the{'\n'}senti-images/presets/ folder in Supabase.
                </Text>
              </View>
            ) : (
              <ScrollView style={st.grid} contentContainerStyle={st.gridContent} showsVerticalScrollIndicator={false}>
                {presets.map((url) => (
                  <TouchableOpacity
                    key={url}
                    style={st.tile}
                    activeOpacity={0.8}
                    onPress={() => onSelectPreset(url)}
                  >
                    <Image source={{ uri: url }} style={st.tileImg} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const makeStyles = (C) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.sheetBg,
    borderTopLeftRadius: ms(18),
    borderTopRightRadius: ms(18),
    borderTopWidth: 0.5,
    borderColor: C.sheetBorder,
    paddingHorizontal: H_PAD,
    paddingTop: vs(16),
    // Pixel cap — a '%' maxHeight resolves against an indefinite-height parent here
    // and is ignored, letting the grid grow off-screen.
    maxHeight: Math.round(SCREEN_HEIGHT * 0.8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  handle: {
    width: ms(36), height: vs(4), borderRadius: ms(2),
    backgroundColor: C.border, alignSelf: 'center', marginBottom: vs(14),
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: vs(12),
  },
  title:   { fontSize: fs(18), fontWeight: '700', color: C.textPrimary },
  closeX:  { fontSize: fs(18), fontWeight: '700', color: C.textMuted, paddingHorizontal: ms(4) },
  galleryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: ms(10),
    backgroundColor: C.surfaceAlt, borderWidth: 0.5, borderColor: C.border,
    borderRadius: ms(14), paddingVertical: vs(13), paddingHorizontal: ms(14),
    marginBottom: vs(18),
  },
  galleryIcon:    { fontSize: fs(20) },
  galleryLabel:   { flex: 1, fontSize: fs(16), fontWeight: '600', color: C.textPrimary },
  galleryChevron: { fontSize: fs(22), fontWeight: '700', color: C.textMuted },
  sectionLabel:   { fontSize: fs(14), fontWeight: '700', color: C.textSecondary, marginBottom: vs(10) },
  stateBox:       { paddingVertical: vs(28), alignItems: 'center', justifyContent: 'center' },
  emptyText:      { fontSize: fs(14), lineHeight: fs(21), color: C.textMuted, textAlign: 'center' },
  // Definite pixel cap gives the ScrollView a bounded, scrollable box so the
  // thumbnails render on-screen instead of overflowing past the device edges.
  grid:           { maxHeight: Math.round(SCREEN_HEIGHT * 0.5) },
  gridContent:    { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP, paddingBottom: vs(4) },
  tile: {
    width: TILE_W, height: TILE_H, borderRadius: ms(12), overflow: 'hidden',
    backgroundColor: C.surfaceAlt, borderWidth: 0.5, borderColor: C.border,
  },
  tileImg: { width: '100%', height: '100%' },
});
