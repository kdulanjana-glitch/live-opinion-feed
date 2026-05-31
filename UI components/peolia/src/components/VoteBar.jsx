// ─────────────────────────────────────────────
// Peolia — VoteBar Component
// src/components/VoteBar.jsx
//
// Usage (before reacting):
//   <VoteBar onVote={(choice) => handleVote(choice)} />
//
// Usage (after reacting):
//   <VoteBar
//     voted="yes"
//     results={{ yes: { pct: 61, count: '142K' },
//                hmm: { pct: 24, count: '56K'  },
//                nah: { pct: 15, count: '35K'  } }}
//   />
// ─────────────────────────────────────────────

import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, useColorScheme,
} from 'react-native';
import { getPeoliaColors } from '../constants/peoliaTheme';

const VOTES = [
  { key: 'yes', emoji: '👍' },
  { key: 'hmm', emoji: '🤔' },
  { key: 'nah', emoji: '👎' },
];

export default function VoteBar({ onVote, voted = null, results = null }) {
  const scheme = useColorScheme();
  const C = getPeoliaColors(scheme);
  const s = makeStyles(C);

  const hasVoted = !!voted;

  return (
    <View style={s.bar}>
      {VOTES.map(({ key, emoji }) => {
        const isChosen = voted === key;
        const isFaded  = hasVoted && !isChosen;
        const result   = results?.[key];

        // Chosen button background
        const chosenBg = key === 'yes' ? C.yesChosen
                       : key === 'hmm' ? C.hmmChosen
                       : C.nahChosen;

        // Default button background
        const defaultBg = key === 'yes' ? C.yesBg
                        : key === 'hmm' ? C.hmmBg
                        : C.nahBg;

        // Text color before voting
        const defaultText = key === 'yes' ? C.yesText
                          : key === 'hmm' ? C.hmmText
                          : C.nahText;

        return (
          <TouchableOpacity
            key={key}
            style={[
              s.btn,
              { backgroundColor: isChosen ? chosenBg : defaultBg },
              isFaded && s.faded,
            ]}
            onPress={() => !hasVoted && onVote?.(key)}
            activeOpacity={hasVoted ? 1 : 0.7}
          >
            {hasVoted ? (
              // After voting — show % and count, no emoji
              <>
                <Text style={[s.pct, isChosen ? s.chosenText : { color: defaultText }]}>
                  {result?.pct ?? 0}%
                </Text>
                <Text style={[s.cnt, isChosen ? s.chosenText : { color: defaultText }]}>
                  {result?.count ?? '0'}
                </Text>
              </>
            ) : (
              // Before voting — show emoji only
              <Text style={s.emoji}>{emoji}</Text>
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
    gap: 5,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 8,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 3,
    borderRadius: 13,
    gap: 3,
  },
  faded: {
    opacity: 0.32,
  },
  emoji: {
    fontSize: 26,
    lineHeight: 30,
  },
  pct: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 16,
  },
  cnt: {
    fontSize: 8.5,
    fontWeight: '600',
  },
  chosenText: {
    color: '#FFFFFF',
  },
});
