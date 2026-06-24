// ─────────────────────────────────────────────
// Peolia — ShareCard
// src/components/ShareCard.jsx
//
// Off-screen component captured to a 1080×1080 PNG by react-native-view-shot.
// NOT part of the normal UI — SentariumScreen mounts it far off-screen, waits a
// couple of frames, then captureRef()s it for the "Ask"/share flow.
//
// ⚠️ FIXED PIXEL DIMENSIONS — do NOT use fs()/ms()/vs()/s() here. Those scale to
// the device screen; this surface must render identically on every device so the
// captured image is device-independent. Every number below is an absolute pixel
// in the 1080×1080 canvas. Colors come from WaveColors (the wave gradient), not
// getPeoliaColors — the card is always dark-on-gradient regardless of app theme.
// ─────────────────────────────────────────────

import React, { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';
import { WaveColors } from '../constants/peoliaTheme';
import PeoliaWordmark from './PeoliaWordmark';

const WAVE_EMOJIS = {
  'Tech': '💻', 'Love': '❤️', 'Money': '💰', 'Life': '🌱',
  'Society': '🌍', 'Politics': '🏛️', 'Food': '🍕', 'Health': '💪',
  'Sports': '⚽', 'Entertainment': '🎬', 'Science': '🔬',
  'Education': '📚', 'Environment': '🌿',
};

const ShareCard = forwardRef(function ShareCard({ senti }, ref) {
  const wave = senti?.wave ?? 'Tech';

  const totalReacts = (senti?.rawCounts?.yes ?? 0)
    + (senti?.rawCounts?.hmm ?? 0)
    + (senti?.rawCounts?.nah ?? 0);
  const showResults = totalReacts >= 10;

  const gradient = WaveColors[wave] ?? WaveColors.default;

  const questionLength = senti?.question?.length ?? 0;
  const questionFontSize =
    questionLength > 120 ? 52 :
    questionLength > 80  ? 64 :
    questionLength > 40  ? 76 : 88;
  const displayQuestion = questionLength > 180
    ? senti.question.slice(0, 180).trimEnd() + '…'
    : (senti?.question ?? '');

  // Highlight the actual winning choice (highest pct), not always Yes.
  const results = senti?.results ?? {
    yes: { pct: 0 }, hmm: { pct: 0 }, nah: { pct: 0 },
  };
  const winner = ['yes', 'hmm', 'nah'].reduce(
    (best, k) => ((results[k]?.pct ?? 0) > (results[best]?.pct ?? 0) ? k : best),
    'yes',
  );

  const RESULT_COLS = [
    { key: 'yes', label: 'Yes' },
    { key: 'hmm', label: 'Hmm' },
    { key: 'nah', label: 'Nah' },
  ];
  const INVITE_COLS = ['👍', '🤔', '👎'];

  return (
    <View
      ref={ref}
      collapsable={false}  // REQUIRED on Android — without it view-shot captures blank
      style={{ width: 1080, height: 1080, position: 'relative', backgroundColor: gradient[0] }}
    >
      {/* Wave gradient background (real two-color linear gradient via SVG) */}
      <Svg width={1080} height={1080} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id="waveGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={gradient[0]} />
            <Stop offset="1" stopColor={gradient[1]} />
          </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width="1080" height="1080" fill="url(#waveGrad)" />
      </Svg>

      {/* Content layer above the gradient (zIndex so Android paints it on top) */}
      <View style={[StyleSheet.absoluteFill, { zIndex: 1 }]}>
        {/* Brand row — top-left */}
        <View style={{ position: 'absolute', top: 72, left: 72 }}>
          <PeoliaWordmark size={64} color="#FFFFFF" />
        </View>

        {/* Wave pill — below brand */}
        <View style={{ position: 'absolute', top: 184, left: 72 }}>
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.18)',
              paddingVertical: 12,
              paddingHorizontal: 36,
              borderRadius: 80,
              alignSelf: 'flex-start',
            }}
          >
            <Text style={{ fontSize: 30, fontWeight: '700', color: '#FFFFFF', letterSpacing: 1.5 }}>
              {`${WAVE_EMOJIS[wave] ?? '🌊'} ${String(wave).toUpperCase()} WAVE`}
            </Text>
          </View>
        </View>

        {/* Question — upper-middle */}
        <View style={{ position: 'absolute', top: 320, left: 72, right: 72 }}>
          <Text
            style={{
              fontSize: questionFontSize,
              fontWeight: '800',
              color: '#FFFFFF',
              lineHeight: questionFontSize * 1.2,
            }}
          >
            {displayQuestion}
          </Text>
        </View>

        {/* Results bars (≥10 reacts) OR vote-invitation emojis (<10) — near bottom */}
        <View style={{ position: 'absolute', left: 72, right: 72, bottom: 220, flexDirection: 'row', gap: 24 }}>
          {showResults
            ? RESULT_COLS.map(({ key, label }) => (
                <View
                  key={key}
                  style={{
                    flex: 1,
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    borderRadius: 32,
                    paddingVertical: 28,
                    alignItems: 'center',
                    ...(key === winner ? { borderWidth: 6, borderColor: '#4ADE80' } : null),
                  }}
                >
                  <Text style={{ fontSize: 64, fontWeight: '800', color: '#FFFFFF' }}>
                    {results[key]?.pct ?? 0}%
                  </Text>
                  <Text style={{ fontSize: 30, fontWeight: '600', color: 'rgba(255,255,255,0.7)' }}>
                    {label}
                  </Text>
                </View>
              ))
            : INVITE_COLS.map((emoji, i) => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    borderRadius: 40,
                    paddingVertical: 32,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 84 }}>{emoji}</Text>
                </View>
              ))}
        </View>

        {/* Footer */}
        <View style={{ position: 'absolute', left: 72, right: 72, bottom: 72 }}>
          <Text style={{ fontSize: 38, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' }}>
            What do you think? Vote on Peolia
          </Text>
        </View>
      </View>
    </View>
  );
});

export default ShareCard;
