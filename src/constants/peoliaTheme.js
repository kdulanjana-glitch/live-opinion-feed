// ─────────────────────────────────────────────
// Peolia Design System — Theme Constants
// Drop this into src/constants/peoliaTheme.js
// ─────────────────────────────────────────────

export const PeoliaColors = {
  light: {
    // Backgrounds
    bg:           '#FFFFFF',
    surface:      '#F9FAFB',
    surfaceAlt:   '#F3F4F6',

    // Borders
    border:       '#E5E7EB',
    borderStrong: '#D1D5DB',

    // Text
    textPrimary:   '#111827',
    textSecondary: '#6B7280',
    textMuted:     '#9CA3AF',

    // Accent — Indigo
    accent:        '#4F46E5',
    accentDark:    '#4338CA',
    accentLight:   '#EEF2FF',
    accentMid:     '#C7D2FE',
    accentText:    '#818CF8',

    // Tab bar
    tabBg:         '#F3F4F6',
    tabBorder:     '#E5E7EB',
    tabActive:     '#4F46E5',
    tabInactive:   '#9CA3AF',

    // Vote — Yes
    yesBg:         '#F0FDF4',
    yesText:       '#16A34A',
    yesChosen:     '#16A34A',

    // Vote — Hmm
    hmmBg:         '#FEFCE8',
    hmmText:       '#CA8A04',
    hmmChosen:     '#CA8A04',

    // Vote — Nah
    nahBg:         '#FEF2F2',
    nahText:       '#DC2626',
    nahChosen:     '#DC2626',

    // Swell / Rare badge
    badgeBg:       '#EEF2FF',
    badgeText:     '#4338CA',

    // Velocity (trending)
    velocity:      '#16A34A',

    // Action icons
    likeColor:     '#F87171',
    iconMuted:     '#9CA3AF',

    // Bottom sheet
    sheetBg:       '#FFFFFF',
    sheetBorder:   '#E5E7EB',
    cancelBg:      '#F3F4F6',
    cancelText:    '#111111',
  },

  dark: {
    // Backgrounds
    bg:           '#0F0F14',
    surface:      '#1A1A28',
    surfaceAlt:   '#1A1A28',

    // Borders
    border:       '#2A2A3A',
    borderStrong: '#374151',

    // Text
    textPrimary:   '#F9FAFB',
    textSecondary: '#9CA3AF',
    textMuted:     '#4B5563',

    // Accent — Indigo
    accent:        '#4F46E5',
    accentDark:    '#4338CA',
    accentLight:   '#1E1B4B',
    accentMid:     '#3730A3',
    accentText:    '#818CF8',

    // Tab bar
    tabBg:         '#1A1A28',
    tabBorder:     '#2A2A3A',
    tabActive:     '#4F46E5',
    tabInactive:   '#4B5563',

    // Vote — Yes
    yesBg:         '#052E16',
    yesText:       '#4ADE80',
    yesChosen:     '#16A34A',

    // Vote — Hmm
    hmmBg:         '#1C1A00',
    hmmText:       '#FACC15',
    hmmChosen:     '#CA8A04',

    // Vote — Nah
    nahBg:         '#2D0A0A',
    nahText:       '#F87171',
    nahChosen:     '#DC2626',

    // Swell / Rare badge
    badgeBg:       '#1E1B4B',
    badgeText:     '#A5B4FC',

    // Velocity (trending)
    velocity:      '#4ADE80',

    // Action icons
    likeColor:     '#F87171',
    iconMuted:     '#4B5563',

    // Bottom sheet
    sheetBg:       '#1A1A28',
    sheetBorder:   '#2A2A3A',
    cancelBg:      '#2A2A3A',
    cancelText:    '#111111',
  },
};

export const PeoliaTypography = {
  sentiQuestion:      { fontSize: 17, fontWeight: '800' },
  sentiQuestionSmall: { fontSize: 14, fontWeight: '800' },
  description:        { fontSize: 10.5, fontWeight: '400', lineHeight: 16 },
  wavePill:           { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  sectionLabel:       { fontSize: 10, fontWeight: '700' },
  metaText:           { fontSize: 8.5, fontWeight: '600' },
  tabLabel:           { fontSize: 6.5, fontWeight: '700' },
  seeMore:            { fontSize: 10.5, fontWeight: '700' },
  votePercent:        { fontSize: 13, fontWeight: '800' },
  voteCount:          { fontSize: 8.5, fontWeight: '600' },
  rankBadge:          { fontSize: 9, fontWeight: '800' },
  velocityText:       { fontSize: 8, fontWeight: '700' },
};

export const PeoliaSpacing = {
  screenPadding:  14,
  cardRadius:     14,
  pillRadius:     20,
  avatarSize:     30,
  tabBarRadius:   25,
  tabItemRadius:  16,
};

// Wave category colors — used for gradient backgrounds
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

// Helper — get colors for current scheme
export const getPeoliaColors = (colorScheme) =>
  PeoliaColors[colorScheme === 'dark' ? 'dark' : 'light'];
