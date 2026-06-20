// ─────────────────────────────────────────────
// Peolia — EmptyState
// src/components/EmptyState.jsx
//
// Branded empty state: big emoji icon → bold headline → supporting subtext,
// centered. Shared across the feed, trending, pin and profile screens.
// ─────────────────────────────────────────────

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { usePeoliaScheme } from '../context/ThemeContext';
import { getPeoliaColors } from '../constants/peoliaTheme';
import { fs, ms, vs } from '../utils/peoliaScale';

export default function EmptyState({ icon, headline, subtext, style }) {
  const scheme = usePeoliaScheme();
  const C = getPeoliaColors(scheme);
  const st = makeStyles(C);

  return (
    <View style={[st.wrap, style]}>
      {!!icon && <Text style={st.icon}>{icon}</Text>}
      <Text style={st.headline}>{headline}</Text>
      {!!subtext && <Text style={st.subtext}>{subtext}</Text>}
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: vs(10),
    paddingHorizontal: ms(32),
  },
  icon:     { fontSize: fs(32) },
  headline: { fontSize: fs(13), fontWeight: '700', color: C.textPrimary, textAlign: 'center' },
  subtext:  { fontSize: fs(10.5), color: C.textSecondary, textAlign: 'center', lineHeight: fs(16) },
});
