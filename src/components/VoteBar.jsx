// ─────────────────────────────────────────────
// Peolia — VoteBar (Scaled for real devices)
// src/components/VoteBar.jsx
// ─────────────────────────────────────────────

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { getPeoliaColors } from '../constants/peoliaTheme';
import { fs, ms, s, vs } from '../utils/peoliaScale';

const VOTES = [
  { key: 'yes', emoji: '👍' },
  { key: 'hmm', emoji: '🤔' },
  { key: 'nah', emoji: '👎' },
];

export default function VoteBar({ onVote, voted = null, results = null }) {
  const scheme = useColorScheme();
  const C = getPeoliaColors(scheme);
  const st = makeStyles(C);

  const hasVoted      = !!voted;
  const hasResults    = results !== null && results !== undefined;
  // Show result view if user voted OR if results are passed (view-only mode)
  const showResultsView = hasVoted || hasResults;
  // View-only: results visible but user hasn't voted yet
  const viewOnly      = hasResults && !hasVoted;

  return (
    <View style={st.bar}>
      {VOTES.map(({ key, emoji }) => {
        const isChosen  = voted === key;
        // Fade others only when user has voted — not in view-only mode
        const isFaded   = hasVoted && !isChosen;
        const result    = results?.[key];
        const chosenBg  = key === 'yes' ? C.yesChosen : key === 'hmm' ? C.hmmChosen : C.nahChosen;
        const defaultBg = key === 'yes' ? C.yesBg     : key === 'hmm' ? C.hmmBg     : C.nahBg;
        const textColor = key === 'yes' ? C.yesText   : key === 'hmm' ? C.hmmText   : C.nahText;

        return (
          <TouchableOpacity
            key={key}
            style={[
              st.btn,
              { backgroundColor: isChosen ? chosenBg : defaultBg },
              isFaded && st.faded,
            ]}
            // Disable once results are visible (voted or view-only)
            onPress={() => !showResultsView && onVote?.(key)}
            activeOpacity={showResultsView ? 1 : 0.7}
          >
            {showResultsView ? (
              // Results view — show % and count
              <>
                <Text style={[st.pct, isChosen ? st.chosenText : { color: textColor }]}>
                  {result?.pct ?? 0}%
                </Text>
                <Text style={[st.cnt, isChosen ? st.chosenText : { color: textColor }]}>
                  {result?.count ?? '0'}
                </Text>
              </>
            ) : (
              // Pre-vote — show emoji only
              <Text style={st.emoji}>{emoji}</Text>
            )}
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
    gap: vs(3),
  },
  faded:      { opacity: 0.32 },
  emoji:      { fontSize: fs(30), lineHeight: fs(36) },
  pct:        { fontSize: fs(17), fontWeight: '800', lineHeight: fs(22) },
  cnt:        { fontSize: fs(14), fontWeight: '600' },
  chosenText: { color: '#FFFFFF' },
});
