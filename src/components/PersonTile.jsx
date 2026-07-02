// ─────────────────────────────────────────────
// Peolia — PersonTile
// src/components/PersonTile.jsx
//
// Grid cell for a follower / following: circular avatar (photo or first
// letter) with display name + @handle below. 3-per-row.
//
// Props: person { id, username, display_name, avatar_url }, width, onPress
// ─────────────────────────────────────────────

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { PeoliaFonts as F , getPeoliaColors } from '../constants/peoliaTheme';
import { usePeoliaScheme } from '../context/ThemeContext';

import { fs, vs } from '../utils/peoliaScale';

export default function PersonTile({ person, width, onPress }) {
  const C = getPeoliaColors(usePeoliaScheme());
  const st = makeStyles(C);

  const d      = Math.round(width * 0.62);  // avatar diameter
  const name   = person?.display_name || person?.username || '—';
  const letter = (person?.display_name || person?.username || '?')[0].toUpperCase();

  return (
    <TouchableOpacity
      style={[st.tile, { width }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <View style={[st.avatar, { width: d, height: d, borderRadius: d / 2 }]}>
        {person?.avatar_url ? (
          <Image source={{ uri: person.avatar_url }} style={st.avatarImg} resizeMode="cover" />
        ) : (
          <Text style={[st.letter, { fontSize: Math.round(d * 0.4) }]}>{letter}</Text>
        )}
      </View>
      <Text style={st.name} numberOfLines={1}>{name}</Text>
      {!!person?.username && <Text style={st.handle} numberOfLines={1}>@{person.username}</Text>}
    </TouchableOpacity>
  );
}

const makeStyles = (C) => StyleSheet.create({
  tile:      { alignItems: 'center', gap: vs(4), paddingVertical: vs(8) },
  avatar:    { backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  letter:    { fontFamily: F.extraBold, color: '#FFFFFF' },
  name:      { fontSize: fs(12), fontFamily: F.bold, color: C.textPrimary, maxWidth: '98%' },
  handle:    { fontFamily: F.regular, fontSize: fs(10.5), color: C.textMuted, maxWidth: '98%' },
});
