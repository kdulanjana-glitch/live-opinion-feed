// ─────────────────────────────────────────────
// Peolia — PeoliaWordmark
// src/components/PeoliaWordmark.jsx
//
// Reusable brand element: [wave mark] [Peolia wordmark].
// This is the ONE place to swap in a real logo later — when artwork
// arrives, replace the <Svg> with <Image source={require(...)} /> and
// every consumer (e.g. ShareCard) updates automatically.
//
// NOTE: this component takes an explicit numeric `size` and does NOT use
// the peoliaScale fs/ms/vs helpers, because it is also rendered inside
// ShareCard's fixed 1080×1080 capture surface, which must stay
// device-independent.
// ─────────────────────────────────────────────

import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export default function PeoliaWordmark({ size = 28, color = '#FFFFFF' }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 16 16">
        <Path
          d="M1 9 Q4 5 8 9 T15 9"
          fill="none"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </Svg>
      <Text
        style={{
          fontWeight: '800',
          fontSize: size * 0.75,
          color,
          letterSpacing: 0.3,
          marginLeft: size * 0.25,
        }}
      >
        Peolia
      </Text>
    </View>
  );
}
