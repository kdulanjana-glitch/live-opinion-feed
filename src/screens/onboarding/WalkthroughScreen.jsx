// ─────────────────────────────────────────────
// Peolia — Onboarding / WalkthroughScreen
// src/screens/onboarding/WalkthroughScreen.jsx
//
// 3 branded slides with a dots indicator. Next advances; on the last slide
// Next → onDone(). Skip → onDone() from any slide. Buttons only, no swipe.
//
// Props: onDone: () => void
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { PeoliaFonts as F , getPeoliaColors } from '../../constants/peoliaTheme';
import { usePeoliaScheme } from '../../context/ThemeContext';

import { fs, ms, vs, s } from '../../utils/peoliaScale';

const SLIDES = [
  {
    emoji: '🌊',
    title: 'Float your opinion',
    body: 'Drop a senti into the Sentarium and watch the world react in real time.',
  },
  {
    emoji: '👍',
    title: 'React with Yes, Hmm or Nah',
    body: "No likes, no followers, no noise. Just your honest take — that's it.",
  },
  {
    emoji: '✨',
    title: 'Find your wave',
    body: 'Join The Swell or stand as The Rare. Every opinion counts here.',
  },
];

export default function WalkthroughScreen({ onDone }) {
  const scheme = usePeoliaScheme();
  const C = getPeoliaColors(scheme);
  const styles = makeStyles(C);

  const [currentSlide, setCurrentSlide] = useState(0);

  const isLast = currentSlide === SLIDES.length - 1;
  const slide  = SLIDES[currentSlide];

  const handleNext = () => {
    if (isLast) { onDone?.(); return; }
    setCurrentSlide((i) => i + 1);
  };

  return (
    <View style={styles.screen}>
      {/* Skip — top right */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => onDone?.()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <Text style={styles.skip}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Slide content */}
      <View style={styles.center}>
        <Text style={styles.emoji}>{slide.emoji}</Text>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </View>

      {/* Dots + Next */}
      <View style={styles.bottom}>
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === currentSlide ? styles.dotActive : styles.dotInactive]}
            />
          ))}
        </View>

        <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.nextText}>{isLast ? 'Get started' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  topBar: {
    paddingTop: vs(48),
    paddingHorizontal: ms(20),
    alignItems: 'flex-end',
  },
  skip: {
    fontSize: fs(11),
    fontFamily: F.semiBold,
    color: C.textMuted,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontFamily: F.regular, fontSize: fs(56),
  },
  title: {
    letterSpacing: -0.2, fontSize: fs(22),
    fontFamily: F.extraBold,
    color: C.textPrimary,
    marginTop: vs(16),
    textAlign: 'center',
  },
  body: {
    fontFamily: F.regular, fontSize: fs(13),
    color: C.textSecondary,
    textAlign: 'center',
    lineHeight: fs(20),
    marginTop: vs(10),
    paddingHorizontal: ms(32),
  },
  bottom: {
    paddingBottom: vs(32),
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ms(5),
  },
  dot: {
    height: s(6),
    borderRadius: s(3),
  },
  dotActive: {
    width: s(20),
    backgroundColor: C.accent,
  },
  dotInactive: {
    width: s(6),
    backgroundColor: C.border,
  },
  nextBtn: {
    backgroundColor: C.accent,
    paddingVertical: vs(14),
    borderRadius: s(30),
    marginHorizontal: ms(24),
    marginTop: vs(16),
    alignItems: 'center',
  },
  nextText: {
    letterSpacing: -0.2, fontSize: fs(14),
    fontFamily: F.extraBold,
    color: '#FFFFFF',
  },
});
