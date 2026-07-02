// ─────────────────────────────────────────────
// Peolia Design System — Theme Constants (Scaled)
// src/constants/peoliaTheme.js
//
// Replace your existing peoliaTheme.js with this.
// Typography now uses fs() for real-device scaling.
// ─────────────────────────────────────────────

import { fs, ms, s } from '../utils/peoliaScale';

export const PeoliaColors = {
  light: {
    bg:           '#FFFFFF',
    surface:      '#F9FAFB',
    surfaceAlt:   '#F3F4F6',
    border:       '#E5E7EB',
    borderStrong: '#D1D5DB',
    textPrimary:   '#111827',
    textSecondary: '#6B7280',
    textMuted:     '#9CA3AF',
    accent:        '#4F46E5',
    accentDark:    '#4338CA',
    accentLight:   '#EEF2FF',
    accentMid:     '#C7D2FE',
    accentText:    '#818CF8',
    tabBg:         '#F3F4F6',
    tabBorder:     '#E5E7EB',
    tabActive:     '#4F46E5',
    tabInactive:   '#9CA3AF',
    yesBg:         '#F0FDF4',
    yesText:       '#16A34A',
    yesChosen:     '#16A34A',
    hmmBg:         '#FEFCE8',
    hmmText:       '#CA8A04',
    hmmChosen:     '#CA8A04',
    nahBg:         '#FEF2F2',
    nahText:       '#DC2626',
    nahChosen:     '#DC2626',
    badgeBg:       '#EEF2FF',
    badgeText:     '#4338CA',
    velocity:      '#16A34A',
    likeColor:     '#F87171',
    iconMuted:     '#9CA3AF',
    sheetBg:       '#FFFFFF',
    sheetBorder:   '#E5E7EB',
    cancelBg:      '#F3F4F6',
    cancelText:    '#111111',
  },

  dark: {
    bg:           '#0F0F14',
    surface:      '#1A1A28',
    surfaceAlt:   '#1A1A28',
    border:       '#2A2A3A',
    borderStrong: '#374151',
    textPrimary:   '#F9FAFB',
    textSecondary: '#9CA3AF',
    textMuted:     '#4B5563',
    accent:        '#4F46E5',
    accentDark:    '#4338CA',
    accentLight:   '#1E1B4B',
    accentMid:     '#3730A3',
    accentText:    '#818CF8',
    tabBg:         '#1A1A28',
    tabBorder:     '#2A2A3A',
    tabActive:     '#4F46E5',
    tabInactive:   '#4B5563',
    yesBg:         '#052E16',
    yesText:       '#4ADE80',
    yesChosen:     '#16A34A',
    hmmBg:         '#1C1A00',
    hmmText:       '#FACC15',
    hmmChosen:     '#CA8A04',
    nahBg:         '#2D0A0A',
    nahText:       '#F87171',
    nahChosen:     '#DC2626',
    badgeBg:       '#1E1B4B',
    badgeText:     '#A5B4FC',
    velocity:      '#4ADE80',
    likeColor:     '#F87171',
    iconMuted:     '#4B5563',
    sheetBg:       '#1A1A28',
    sheetBorder:   '#2A2A3A',
    cancelBg:      '#2A2A3A',
    cancelText:    '#111111',
  },
};

// ── Font families (Plus Jakarta Sans) ──
// Loaded in src/app/_layout.tsx via @expo-google-fonts/plus-jakarta-sans.
// No 500 variant is loaded — map fontWeight '500'/'600' → semiBold.
export const PeoliaFonts = {
  regular:   'PlusJakartaSans_400Regular',
  semiBold:  'PlusJakartaSans_600SemiBold',
  bold:      'PlusJakartaSans_700Bold',
  extraBold: 'PlusJakartaSans_800ExtraBold',
};

// ── Typography — ALL values go through fs(); weights expressed as fontFamily ──
export const PeoliaTypography = {
  sentiQuestion:      { fontSize: fs(17), fontFamily: PeoliaFonts.extraBold, letterSpacing: -0.2 },
  sentiQuestionSmall: { fontSize: fs(14), fontFamily: PeoliaFonts.extraBold, letterSpacing: -0.2 },
  description:        { fontSize: fs(13), fontFamily: PeoliaFonts.regular, lineHeight: fs(20) },
  wavePill:           { fontSize: fs(12), fontFamily: PeoliaFonts.bold, letterSpacing: 0.4 },
  sectionLabel:       { fontSize: fs(13), fontFamily: PeoliaFonts.bold },
  metaText:           { fontSize: fs(12), fontFamily: PeoliaFonts.semiBold },
  tabLabel:           { fontSize: fs(11), fontFamily: PeoliaFonts.bold },
  seeMore:            { fontSize: fs(13), fontFamily: PeoliaFonts.bold },
  votePercent:        { fontSize: fs(16), fontFamily: PeoliaFonts.extraBold, letterSpacing: -0.2 },
  voteCount:          { fontSize: fs(12), fontFamily: PeoliaFonts.semiBold },
  rankBadge:          { fontSize: fs(12), fontFamily: PeoliaFonts.extraBold, letterSpacing: -0.2 },
  velocityText:       { fontSize: fs(12), fontFamily: PeoliaFonts.bold },
};

// ── Spacing — ALL values go through ms() or s() ──
export const PeoliaSpacing = {
  screenPadding:  ms(16),
  cardRadius:     ms(14),
  pillRadius:     ms(20),
  avatarSize:     s(38),
  tabBarRadius:   ms(28),
  tabItemRadius:  ms(18),
};

export const WaveColors = {
  'Tech':          ['#1E1B4B', '#4338CA'],
  'Love':          ['#831843', '#EC4899'],
  'Money':         ['#78350F', '#D97706'],
  'Life':          ['#134E4A', '#0D9488'],
  'Society':       ['#1F2937', '#6B7280'],
  'Politics':      ['#7F1D1D', '#DC2626'],
  'Food':          ['#7C2D12', '#EA580C'],
  'Health':        ['#064E3B', '#059669'],
  'Sports':        ['#1E3A5F', '#2563EB'],
  'Entertainment': ['#3B0764', '#9333EA'],
  'Science':       ['#0C4A6E', '#0EA5E9'],
  'Education':     ['#1A2E05', '#65A30D'],
  'Environment':   ['#064E3B', '#059669'],
  'default':       ['#1E1B4B', '#4338CA'],
};

export const getPeoliaColors = (colorScheme) =>
  PeoliaColors[colorScheme === 'dark' ? 'dark' : 'light'];
