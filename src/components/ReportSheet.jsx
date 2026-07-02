// ─────────────────────────────────────────────
// Peolia — ReportSheet
// src/components/ReportSheet.jsx
//
// Bottom sheet shown when a user taps "Flag" on a senti. Pick a reason →
// onSubmit(reasonKey). The parent inserts into public.senti_reports and hides
// the senti. Reason keys must match the senti_reports.reason CHECK constraint.
// ─────────────────────────────────────────────

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { PeoliaFonts as F , getPeoliaColors } from '../constants/peoliaTheme';
import { usePeoliaScheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fs, ms, vs } from '../utils/peoliaScale';

const REASONS = [
  { key: 'spam',           label: 'Spam or scam',            icon: '🚫' },
  { key: 'harassment',     label: 'Harassment or bullying',  icon: '😠' },
  { key: 'hate',           label: 'Hate speech',             icon: '⚠️' },
  { key: 'misinformation', label: 'False information',       icon: '❗' },
  { key: 'sexual',         label: 'Sexual content',          icon: '🔞' },
  { key: 'violence',       label: 'Violence or threats',     icon: '🩸' },
  { key: 'other',          label: 'Something else',          icon: '⋯'  },
];

export default function ReportSheet({ visible, onClose, onSubmit, submitting }) {
  const scheme = usePeoliaScheme();
  const C = getPeoliaColors(scheme);
  const st = makeStyles(C);
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableOpacity style={st.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ width: '100%' }}>
          <View style={[st.sheet, { paddingBottom: vs(20) + insets.bottom }]}>
            <View style={st.handle} />

            <Text style={st.title}>Report this senti</Text>
            <Text style={st.subtitle}>Why are you reporting it? This is anonymous.</Text>

            <View style={st.list}>
              {REASONS.map((r) => (
                <TouchableOpacity
                  key={r.key}
                  style={st.row}
                  activeOpacity={0.7}
                  disabled={submitting}
                  onPress={() => onSubmit(r.key)}
                >
                  <Text style={st.rowIcon}>{r.icon}</Text>
                  <Text style={st.rowLabel}>{r.label}</Text>
                  <Text style={st.rowChevron}>›</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={st.cancelBtn} onPress={onClose} activeOpacity={0.7} disabled={submitting}>
              <Text style={st.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const makeStyles = (C) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
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
    width: ms(36), height: vs(4), borderRadius: ms(2),
    backgroundColor: C.border, alignSelf: 'center', marginBottom: vs(14),
  },
  title:    { fontSize: fs(18), fontFamily: F.bold, color: C.textPrimary },
  subtitle: { fontFamily: F.regular, fontSize: fs(14), color: C.textSecondary, marginTop: vs(4), marginBottom: vs(12) },
  list:     { gap: vs(2) },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: ms(12),
    paddingVertical: vs(12), paddingHorizontal: ms(4),
  },
  rowIcon:    { fontFamily: F.regular, fontSize: fs(18), width: ms(24), textAlign: 'center' },
  rowLabel:   { flex: 1, fontSize: fs(16), fontFamily: F.semiBold, color: C.textPrimary },
  rowChevron: { fontSize: fs(22), fontFamily: F.bold, color: C.textMuted },
  cancelBtn: {
    marginTop: vs(12), paddingVertical: vs(13), borderRadius: ms(14),
    backgroundColor: C.cancelBg, alignItems: 'center',
  },
  cancelText: { fontSize: fs(16), fontFamily: F.bold, color: C.textPrimary },
});
