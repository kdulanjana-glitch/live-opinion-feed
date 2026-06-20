// ─────────────────────────────────────────────
// Peolia — FAQScreen
// src/screens/FAQScreen.jsx
//
// Help & Enquiries page. Reached from the Profile ⋮ menu → Support. Shows an
// expandable FAQ list and a contact section that opens the user's mail app.
//
// Props: onBack
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { usePeoliaScheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { getPeoliaColors } from '../constants/peoliaTheme';
import { fs, ms, vs, s } from '../utils/peoliaScale';

const SUPPORT_EMAIL = 'support@peolia.app';

const FAQS = [
  {
    q: 'What is a senti?',
    a: 'A senti is a short opinion question you float to the community. Other citizens react with Yes, Hmm, or Nah, and you see how the world leans in real time.',
  },
  {
    q: 'What is Citizen DNA?',
    a: 'Your Citizen DNA is a visual breakdown of the topics (waves) you react to most. It builds up automatically as you react to sentis, and it is public on your profile.',
  },
  {
    q: 'Who can see my phone, date of birth, and gender?',
    a: 'These are private by default. On the Settings screen you can flip a switch under each one to make it visible to others. If the switch stays locked, only you can see it.',
  },
  {
    q: 'Can I change my username?',
    a: 'Yes, but only once every 14 days. Your display name and bio can be changed at any time from Settings.',
  },
  {
    q: 'I signed up with my phone — can I also log in with email?',
    a: 'Yes. Open Settings and add a recovery email. After that you can sign in or recover your account using either your phone number or that email.',
  },
  {
    q: 'Can I change my date of birth?',
    a: 'No. Your date of birth is permanent once set during signup, so the age shown on your profile stays accurate.',
  },
  {
    q: 'How do votes work?',
    a: 'Each citizen gets one reaction per senti and it cannot be changed once cast, so every result reflects a genuine first impression.',
  },
  {
    q: 'How do I report a senti?',
    a: 'Open the senti and use the report option. Pick a reason and our team reviews it. Reported content that breaks the rules is removed.',
  },
];

export default function FAQScreen({ onBack }) {
  const scheme = usePeoliaScheme();
  const C  = getPeoliaColors(scheme);
  const st = makeStyles(C);
  const insets = useSafeAreaInsets();

  const [openIdx, setOpenIdx] = useState(null);

  const toggle = (i) => setOpenIdx((prev) => (prev === i ? null : i));

  const contactSupport = async () => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Peolia enquiry')}`;
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) { await Linking.openURL(url); return; }
      throw new Error('no mail app');
    } catch {
      Alert.alert('Contact us', `Email us at ${SUPPORT_EMAIL}`);
    }
  };

  return (
    <View style={st.screen}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={C.bg} />

      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={onBack} style={st.backBtn} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="ti-chevron-left" size={fs(22)} color={C.textPrimary} />
          <Text style={st.headerTitle}>Help & Support</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: vs(24) + insets.bottom }}>
        {/* FAQ */}
        <Text style={st.sectionHead}>Frequently asked</Text>
        <View style={st.faqList}>
          {FAQS.map((item, i) => {
            const open = openIdx === i;
            return (
              <View key={i} style={st.faqItem}>
                <TouchableOpacity style={st.faqQRow} onPress={() => toggle(i)} activeOpacity={0.7}>
                  <Text style={st.faqQ}>{item.q}</Text>
                  <Text style={st.faqChevron}>{open ? '−' : '+'}</Text>
                </TouchableOpacity>
                {open && <Text style={st.faqA}>{item.a}</Text>}
              </View>
            );
          })}
        </View>

        {/* Enquiries */}
        <Text style={st.sectionHead}>Still need help?</Text>
        <View style={st.contactCard}>
          <Text style={st.contactText}>
            Can't find what you're looking for? Send us your question and we'll get back to you.
          </Text>
          <TouchableOpacity style={st.contactBtn} onPress={contactSupport} activeOpacity={0.85}>
            <Text style={st.contactBtnText}>✉️  Contact support</Text>
          </TouchableOpacity>
          <Text style={st.contactEmail}>{SUPPORT_EMAIL}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  screen: {
    flex: 1, backgroundColor: C.bg,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: ms(14), paddingTop: vs(10), paddingBottom: vs(8),
  },
  backBtn:  { flexDirection: 'row', alignItems: 'center', gap: ms(4) },
  headerTitle: { fontSize: fs(18), fontWeight: '800', color: C.textPrimary },
  sectionHead: {
    fontSize: fs(12), fontWeight: '800', color: C.textMuted, letterSpacing: 0.6,
    textTransform: 'uppercase', marginTop: vs(18), marginBottom: vs(8),
    paddingHorizontal: ms(16),
  },
  faqList: { paddingHorizontal: ms(16), gap: vs(8) },
  faqItem: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: ms(12), paddingHorizontal: ms(14), paddingVertical: vs(12),
  },
  faqQRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: ms(10) },
  faqQ: { flex: 1, fontSize: fs(14), fontWeight: '700', color: C.textPrimary },
  faqChevron: { fontSize: fs(20), fontWeight: '700', color: C.textMuted, width: ms(18), textAlign: 'center' },
  faqA: { fontSize: fs(13), color: C.textSecondary, lineHeight: fs(20), marginTop: vs(8) },
  contactCard: {
    marginHorizontal: ms(16), backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: ms(14), padding: ms(16), alignItems: 'center',
  },
  contactText: { fontSize: fs(13), color: C.textSecondary, lineHeight: fs(20), textAlign: 'center' },
  contactBtn: {
    marginTop: vs(14), backgroundColor: C.accent, paddingVertical: vs(12),
    paddingHorizontal: ms(24), borderRadius: ms(30), alignItems: 'center',
  },
  contactBtnText: { fontSize: fs(14), fontWeight: '800', color: '#FFFFFF' },
  contactEmail: { fontSize: fs(12), fontWeight: '600', color: C.textMuted, marginTop: vs(10) },
});
