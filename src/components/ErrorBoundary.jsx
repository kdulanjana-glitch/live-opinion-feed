// ─────────────────────────────────────────────
// Peolia — ErrorBoundary
// src/components/ErrorBoundary.jsx
//
// Catches render crashes anywhere in the tree and
// shows a recoverable error screen instead of the
// blank white screen RN gives by default.
// ─────────────────────────────────────────────

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { PeoliaFonts as F , getPeoliaColors } from '../constants/peoliaTheme';
import { usePeoliaScheme } from '../context/ThemeContext';
import { captureError } from '../lib/crash';

import { fs, ms, vs } from '../utils/peoliaScale';

function ErrorFallback({ message, onRetry }) {
  const scheme = usePeoliaScheme();
  const C = getPeoliaColors(scheme);
  const st = makeStyles(C);

  return (
    <View style={st.screen}>
      <Text style={st.icon}>🌊</Text>
      <Text style={st.title}>Something went wrong</Text>
      <Text style={st.message} numberOfLines={4}>{message}</Text>
      <TouchableOpacity style={st.retryBtn} onPress={onRetry} activeOpacity={0.7}>
        <Text style={st.retryText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught', error, info?.componentStack);
    captureError(error, { componentStack: info?.componentStack });
  }

  handleRetry = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <ErrorFallback
          message={String(this.state.error?.message ?? this.state.error)}
          onRetry={this.handleRetry}
        />
      );
    }
    return this.props.children;
  }
}

const makeStyles = (C) => StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bg,
    paddingHorizontal: ms(32),
  },
  icon:    { fontFamily: F.regular, fontSize: fs(44), marginBottom: vs(14) },
  title:   { letterSpacing: -0.2, fontSize: fs(18), fontFamily: F.extraBold, color: C.textPrimary, marginBottom: vs(8) },
  message: {
    fontSize: fs(14), fontFamily: F.semiBold, color: C.textSecondary,
    textAlign: 'center', lineHeight: fs(21), marginBottom: vs(20),
  },
  retryBtn: {
    paddingVertical: vs(10), paddingHorizontal: ms(28),
    borderRadius: ms(20), backgroundColor: C.accent,
  },
  retryText: { fontSize: fs(15), fontFamily: F.bold, color: '#FFFFFF' },
});
