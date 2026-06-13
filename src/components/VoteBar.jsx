// ─────────────────────────────────────────────
// Peolia — VoteBar (Scaled for real devices)
// src/components/VoteBar.jsx
//
// Only ever shows the 3 emoji buttons. Percentages/counts now live in
// VoteResultsPanel. After voting, the chosen button takes its "Chosen" colour
// and the bar becomes non-pressable.
// ─────────────────────────────────────────────

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import * as Haptics from 'expo-haptics';
import { getPeoliaColors } from '../constants/peoliaTheme';
import { fs, ms, vs } from '../utils/peoliaScale';

const VOTES = [
  { key: 'yes', emoji: '👍' },
  { key: 'hmm', emoji: '🤔' },
  { key: 'nah', emoji: '👎' },
];

export default function VoteBar({ onVote, voted = null }) {
  const scheme = useColorScheme();
  const C = getPeoliaColors(scheme);
  const st = makeStyles(C);

  const hasVoted = !!voted;

  return (
    <View style={st.bar}>
      {VOTES.map(({ key, emoji }) => {
        const isChosen  = voted === key;
        const chosenBg  = key === 'yes' ? C.yesChosen : key === 'hmm' ? C.hmmChosen : C.nahChosen;
        const defaultBg = key === 'yes' ? C.yesBg     : key === 'hmm' ? C.hmmBg     : C.nahBg;

        return (
          <TouchableOpacity
            key={key}
            style={[st.btn, { backgroundColor: isChosen ? chosenBg : defaultBg }]}
            onPress={() => {
              // Light tactile tap on vote (best-effort — never block the vote)
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onVote?.(key);
            }}
            disabled={hasVoted}                       // not pressable after voting
            activeOpacity={hasVoted ? 1 : 0.7}
          >
            <Text style={st.emoji}>{emoji}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: ms(6),
    paddingHorizontal: ms(12),
    paddingTop: vs(6),
    paddingBottom: vs(10),
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: vs(12),
    paddingHorizontal: ms(4),
    borderRadius: ms(14),
  },
  emoji: { fontSize: fs(30), lineHeight: fs(36) },
});
