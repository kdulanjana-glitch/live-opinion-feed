// ─────────────────────────────────────────────
// Peolia — VoteResultsPanel
// src/components/VoteResultsPanel.jsx
//
// Three "towers" that sit directly above VoteBar's 3 emoji buttons (same flex
// layout so they line up). Each tower, bottom→top: count → coloured bar →
// percentage. Bars animate their height from 0 → target when `visible` flips
// true. Returns null while hidden so there's no flash of un-animated bars.
//
// Props: visible (boolean), results { yes:{pct,count}, hmm:{…}, nah:{…} }
// ─────────────────────────────────────────────

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
} from 'react-native';
import { PeoliaFonts as F , getPeoliaColors } from '../constants/peoliaTheme';
import { usePeoliaScheme } from '../context/ThemeContext';
import { fs, ms, vs, s } from '../utils/peoliaScale';

const VOTES = ['yes', 'hmm', 'nah'];
const MAX_BAR = vs(60);   // tallest a bar can be (100%)
const MIN_BAR = vs(4);    // always visible, even at low %

export default function VoteResultsPanel({ visible, results }) {
  const scheme = usePeoliaScheme();
  const C = getPeoliaColors(scheme);
  const st = makeStyles(C);

  // Single 0→1 driver; each bar interpolates to its own target height.
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: 400,
        useNativeDriver: false,   // height is not supported by the native driver
      }).start();
    } else {
      progress.setValue(0);       // reset so it re-animates next time
    }
    return () => progress.stopAnimation();
  }, [visible, progress]);

  if (!visible) return null;

  const barColor = (key) => (key === 'yes' ? C.yesChosen : key === 'hmm' ? C.hmmChosen : C.nahChosen);

  return (
    <View style={st.row}>
      {VOTES.map((key) => {
        const r      = results?.[key] ?? {};
        const pct    = r.pct ?? 0;
        const count  = r.count ?? '0';
        const target = Math.max(MIN_BAR, (pct / 100) * MAX_BAR);
        const height = progress.interpolate({ inputRange: [0, 1], outputRange: [0, target] });

        return (
          <View key={key} style={st.tower}>
            <Text style={st.pct}>{pct}%</Text>
            <View style={st.track}>
              <Animated.View style={[st.bar, { height, backgroundColor: barColor(key) }]} />
            </View>
            <Text style={st.count}>{count}</Text>
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  // Mirror VoteBar's bar layout so towers align above each emoji button
  row: {
    flexDirection: 'row',
    gap: ms(6),
    paddingHorizontal: ms(12),
    paddingTop: vs(2),   // sit a little higher / tighter to the content above
  },
  tower: {
    flex: 1,
    alignItems: 'center',
    gap: vs(2),
  },
  pct:   { letterSpacing: -0.2, fontSize: fs(16), fontFamily: F.extraBold, color: C.textPrimary },
  track: {
    height: MAX_BAR,
    width: '100%',
    justifyContent: 'flex-end',   // bar grows up from a shared baseline
    alignItems: 'center',
  },
  bar:   { width: '64%', borderRadius: ms(6) },
  count: { fontSize: fs(12), fontFamily: F.semiBold, color: C.textMuted },
});
