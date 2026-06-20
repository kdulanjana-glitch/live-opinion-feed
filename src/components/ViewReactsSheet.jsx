// ─────────────────────────────────────────────
// Peolia — ViewReactsSheet (Scaled for real devices)
// src/components/ViewReactsSheet.jsx
// ─────────────────────────────────────────────

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { usePeoliaScheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPeoliaColors } from '../constants/peoliaTheme';
import { fs, ms, vs } from '../utils/peoliaScale';

export default function ViewReactsSheet({ visible, onCancel, onConfirm }) {
  const scheme = usePeoliaScheme();
  const C = getPeoliaColors(scheme);
  const st = makeStyles(C);
  const insets = useSafeAreaInsets();

  return (
    // Modal blocks ALL touches behind it (card, vote bar, tab bar) until the
    // user picks Cancel or "View anyway". Android back button maps to Cancel.
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={st.backdrop}>
        {/* Bottom inset keeps the buttons above the Android system nav bar */}
        <View style={[st.sheet, { paddingBottom: vs(20) + insets.bottom }]}>
          <View style={st.handle} />
          <Text style={st.title}>Heads up</Text>
          <Text style={st.body}>
            Viewing reacts now means you can never react to this senti — ever. This can't be undone.
          </Text>
          <View style={st.btnRow}>
            <TouchableOpacity style={[st.btn, st.cancelBtn]} onPress={onCancel} activeOpacity={0.7}>
              <Text style={[st.btnText, st.cancelText]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.btn, st.confirmBtn]} onPress={onConfirm} activeOpacity={0.7}>
              <Text style={[st.btnText, st.confirmText]}>View anyway</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (C) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.sheetBg,
    borderTopLeftRadius: ms(18),
    borderTopRightRadius: ms(18),
    borderTopWidth: 0.5,
    borderColor: C.sheetBorder,
    paddingHorizontal: ms(18),
    paddingTop: vs(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  handle: {
    width: ms(36),
    height: vs(4),
    borderRadius: ms(2),
    backgroundColor: C.border,
    alignSelf: 'center',
    marginBottom: vs(14),
  },
  title:       { fontSize: fs(18), fontWeight: '700', color: C.textPrimary, marginBottom: vs(8) },
  body:        { fontSize: fs(15), lineHeight: fs(23), color: C.textSecondary, marginBottom: vs(16) },
  btnRow:      { flexDirection: 'row', gap: ms(10) },
  btn:         { flex: 1, paddingVertical: vs(14), paddingHorizontal: ms(4), borderRadius: ms(14), alignItems: 'center' },
  cancelBtn:   { backgroundColor: C.cancelBg },
  confirmBtn:  { backgroundColor: C.accent },
  btnText:     { fontSize: fs(16), fontWeight: '700' },
  cancelText:  { color: C.textPrimary },
  confirmText: { color: '#FFFFFF' },
});
