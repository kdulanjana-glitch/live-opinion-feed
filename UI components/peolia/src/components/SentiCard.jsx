// ─────────────────────────────────────────────
// Peolia — SentiCard Component
// src/components/SentiCard.jsx
//
// The full-screen feed card used in the Sentarium.
// Handles: before react, after react, see more/less,
//          view reacts warning sheet.
//
// Usage:
//   <SentiCard
//     senti={{
//       id: '123',
//       question: 'Should AI companies be legally liable?',
//       description: 'As AI systems become more autonomous...',
//       wave: 'Tech',
//       creator: { initials: 'JK', avatarUrl: null },
//       likes: 24000,
//       voices: 1200,
//       pins: 8400,
//       results: {
//         yes: { pct: 61, count: '142K' },
//         hmm: { pct: 24, count: '56K'  },
//         nah: { pct: 15, count: '35K'  },
//       },
//     }}
//     onVote={(sentiId, choice) => handleVote(sentiId, choice)}
//     onLike={(sentiId) => handleLike(sentiId)}
//     onVoice={(sentiId) => handleVoice(sentiId)}
//     onPin={(sentiId) => handlePin(sentiId)}
//     onAsk={(sentiId) => handleAsk(sentiId)}
//     userVote={null}         // null = not voted, 'yes'|'hmm'|'nah' = voted
//     userViewedReacts={false}
//   />
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  useColorScheme, Dimensions,
} from 'react-native';
import { getPeoliaColors } from '../constants/peoliaTheme';
import WavePill from './WavePill';
import VoteBar from './VoteBar';
import ActionBar from './ActionBar';
import ViewReactsSheet from './ViewReactsSheet';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const CHAR_TRUNCATE = 200; // chars shown before "see more"

export default function SentiCard({
  senti,
  onVote,
  onLike,
  onVoice,
  onPin,
  onAsk,
  userVote          = null,
  userViewedReacts  = false,
}) {
  const scheme = useColorScheme();
  const C = getPeoliaColors(scheme);
  const s = makeStyles(C);

  const [expanded,       setExpanded]       = useState(false);
  const [showSheet,      setShowSheet]       = useState(false);
  const [viewedReacts,   setViewedReacts]    = useState(userViewedReacts);

  const hasVoted     = !!userVote;
  const showReacts   = hasVoted || viewedReacts;
  const desc         = senti?.description ?? '';
  const truncated    = desc.length > CHAR_TRUNCATE && !expanded;
  const displayDesc  = truncated ? desc.slice(0, CHAR_TRUNCATE) : desc;

  const handleViewReacts = () => {
    if (hasVoted) return; // already voted — no warning needed
    setShowSheet(true);
  };

  const confirmViewReacts = () => {
    setShowSheet(false);
    setViewedReacts(true);
    // TODO: persist to Supabase — mark this senti as view-locked for user
  };

  return (
    <View style={s.card}>

      {/* ── Top row: View reacts + Avatar ── */}
      <View style={s.topRow}>
        {!hasVoted ? (
          <TouchableOpacity style={s.vrBtn} onPress={handleViewReacts} activeOpacity={0.7}>
            <Text style={s.vrIcon}>👁</Text>
            <Text style={s.vrText}>View reacts</Text>
          </TouchableOpacity>
        ) : (
          <View /> // spacer — button disappears after voting
        )}

        {/* Creator avatar */}
        <View style={s.avatar}>
          <Text style={s.avatarText}>
            {senti?.creator?.initials ?? '??'}
          </Text>
        </View>
      </View>

      {/* ── Wave pill ── */}
      <WavePill wave={senti?.wave ?? 'Tech'} style={s.wavePill} />

      {/* ── Main content row: text + action bar ── */}
      <View style={s.mainRow}>

        {/* Text column */}
        <View style={s.textCol}>
          <Text style={[s.question, expanded && s.questionSmall]}>
            {senti?.question ?? ''}
          </Text>

          {/* Description with inline see more */}
          <Text style={s.description}>
            {displayDesc}
            {truncated && (
              <Text
                style={s.seeMore}
                onPress={() => setExpanded(true)}
              >
                {' '}see more
              </Text>
            )}
            {expanded && (
              <Text
                style={s.seeMore}
                onPress={() => setExpanded(false)}
              >
                {' '}see less
              </Text>
            )}
          </Text>
        </View>

        {/* Action bar */}
        <ActionBar
          likes={senti?.likes}
          voices={senti?.voices}
          pins={senti?.pins}
          onLike={() => onLike?.(senti?.id)}
          onVoice={() => onVoice?.(senti?.id)}
          onPin={() => onPin?.(senti?.id)}
          onAsk={() => onAsk?.(senti?.id)}
          transparent={false}
        />
      </View>

      {/* ── Swell / Rare badge — shown after voting ── */}
      {hasVoted && (
        <View style={s.swellBadge}>
          <Text style={s.swellText}>
            {userVote === 'yes' && "You said Yes · You're in the swell 🌊"}
            {userVote === 'hmm' && "You said Hmm · You're still thinking 🤔"}
            {userVote === 'nah' && "You said Nah · You're one of The Rare ✨"}
          </Text>
        </View>
      )}

      {/* ── Skip hint ── */}
      <View style={s.skipHint}>
        <Text style={s.skipText}>↑ Swipe up to skip</Text>
      </View>

      {/* ── Vote bar ── */}
      <VoteBar
        voted={hasVoted ? userVote : null}
        results={showReacts ? senti?.results : null}
        onVote={(choice) => onVote?.(senti?.id, choice)}
      />

      {/* ── View reacts bottom sheet ── */}
      <ViewReactsSheet
        visible={showSheet}
        onCancel={() => setShowSheet(false)}
        onConfirm={confirmViewReacts}
      />

    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // Top row
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 8,
    minHeight: 28,
  },
  vrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 20,
    backgroundColor: C.surfaceAlt,
    borderWidth: 0.5,
    borderColor: C.borderStrong,
  },
  vrIcon: {
    fontSize: 9,
  },
  vrText: {
    fontSize: 8.5,
    fontWeight: '600',
    color: C.textPrimary,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.accentLight,
    borderWidth: 1.5,
    borderColor: C.accentMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: C.accent,
  },

  // Wave pill
  wavePill: {
    marginTop: 7,
    marginHorizontal: 14,
  },

  // Main content row
  mainRow: {
    flex: 1,
    flexDirection: 'row',
    paddingTop: 9,
    minHeight: 0,
    overflow: 'hidden',
  },
  textCol: {
    flex: 1,
    paddingLeft: 14,
    overflow: 'hidden',
  },
  question: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
    color: C.textPrimary,
    marginBottom: 7,
  },
  questionSmall: {
    fontSize: 14,
  },
  description: {
    fontSize: 10.5,
    lineHeight: 16,
    color: C.textSecondary,
  },
  seeMore: {
    fontSize: 10.5,
    fontWeight: '700',
    color: C.accentText,
  },

  // Swell / Rare badge
  swellBadge: {
    marginTop: 2,
    marginBottom: 3,
    marginHorizontal: 14,
    backgroundColor: C.badgeBg,
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  swellText: {
    fontSize: 8.5,
    fontWeight: '600',
    color: C.badgeText,
  },

  // Skip hint
  skipHint: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 2,
  },
  skipText: {
    fontSize: 8.5,
    fontWeight: '500',
    color: C.border,
  },
});
