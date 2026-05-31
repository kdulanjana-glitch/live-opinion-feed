// ─────────────────────────────────────────────
// Peolia — ViewReactsSheet Component
// src/components/ViewReactsSheet.jsx
//
// Bottom sheet that appears when user taps "View reacts"
// before voting. Overlays vote bar, sits above tab pill.
//
// Usage:
//   <ViewReactsSheet
//     visible={showSheet}
//     onCancel={() => setShowSheet(false)}
//     onConfirm={() => { setShowSheet(false); handleViewReacts(); }}
//   />
// ─────────────────────────────────────────────

import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  useColorScheme, Modal, Animated,
} from 'react-native';
import { getPeoliaColors } from '../constants/peoliaTheme';

// Tab bar height offset — sheet sits above the tab pill
const TAB_BAR_HEIGHT = 68;

export default function ViewReactsSheet({ visible, onCancel, onConfirm }) {
  const scheme = useColorScheme();
  const C = getPeoliaColors(scheme);
  const s = makeStyles(C);

  if (!visible) return null;

  return (
    <View style={s.overlay} pointerEvents="box-none">
      <View style={s.sheet}>
        {/* Handle bar */}
        <View style={s.handle} />

        <Text style={s.title}>Heads up</Text>
        <Text style={s.body}>
          Viewing reacts now means you can never react to this senti — ever.
          This can't be undone.
        </Text>

        <View style={s.btnRow}>
          <TouchableOpacity
            style={[s.btn, s.cancelBtn]}
            onPress={onCancel}
            activeOpacity={0.7}
          >
            <Text style={[s.btnText, s.cancelText]}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.btn, s.confirmBtn]}
            onPress={onConfirm}
            activeOpacity={0.7}
          >
            <Text style={[s.btnText, s.confirmText]}>View anyway</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: TAB_BAR_HEIGHT,
    zIndex: 10,
  },
  sheet: {
    backgroundColor: C.sheetBg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 0.5,
    borderColor: C.sheetBorder,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 14,
    // Shadow for light mode
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  handle: {
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textPrimary,
    marginBottom: 4,
  },
  body: {
    fontSize: 9.5,
    lineHeight: 14,
    color: C.textSecondary,
    marginBottom: 11,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 6,
  },
  btn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: C.cancelBg,
  },
  confirmBtn: {
    backgroundColor: C.accent,
  },
  btnText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cancelText: {
    color: C.cancelText,
  },
  confirmText: {
    color: '#FFFFFF',
  },
});
