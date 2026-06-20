// ─────────────────────────────────────────────
// Peolia — Onboarding / SplashScreen
// src/screens/onboarding/SplashScreen.jsx
//
// Brand logo + tagline for 2 seconds, with a bottom progress bar that fills
// left → right, then calls onDone() to advance to the walkthrough.
//
// Props: onDone: () => void  (called automatically after 2s)
// ─────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { usePeoliaScheme } from '../../context/ThemeContext';
import { getPeoliaColors } from '../../constants/peoliaTheme';
import { fs, ms, vs, s } from '../../utils/peoliaScale';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SplashScreen({ onDone }) {
  const scheme = usePeoliaScheme();
  const C = getPeoliaColors(scheme);
  const styles = makeStyles(C);

  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: false,   // animating width — native driver doesn't support it
    });
    anim.start();

    const timer = setTimeout(() => onDone?.(), 2000);

    return () => {
      anim.stop();
      clearTimeout(timer);
    };
  }, [progress, onDone]);

  const fillWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.screen}>
      <Text style={styles.logo}>🌊</Text>
      <Text style={styles.name}>Peolia</Text>
      <Text style={styles.tagline}>The world's opinion. In real time.</Text>

      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { width: fillWidth }]} />
      </View>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontSize: fs(64),
    marginBottom: vs(10),
  },
  name: {
    fontSize: fs(32),
    fontWeight: '800',
    color: C.textPrimary,
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: fs(13),
    color: C.textMuted,
    marginTop: vs(8),
  },
  barTrack: {
    position: 'absolute',
    bottom: vs(56),
    alignSelf: 'center',
    width: SCREEN_WIDTH - ms(80),   // bar width derived from screen width
    height: vs(2),
    borderRadius: s(2),
    backgroundColor: C.surfaceAlt,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: s(2),
    backgroundColor: C.accent,
  },
});
