// ─────────────────────────────────────────────
// Peolia — SentiCard Component
// src/components/SentiCard.jsx
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
const CHAR_TRUNCATE = 200;

export default function SentiCard({
  senti,
  onVote,
  onLike,
  onVoice,
  onPin,
  onAsk,
  onAvatarPress,      // ← added: tap creator avatar → navigate to profile
  userVote          = null,
  userViewedReacts  = false,
}) {
  const scheme = useColorScheme();
  const C = getPeoliaColors(scheme);
  const s = makeStyles(C);

  const [expanded,     setExpanded]     = useState(false);
  const [showSheet,    setShowSheet]    = useState(false);
  const [viewedReacts, setViewedReacts] = useState(userViewedReacts);

  const hasVoted    = !!userVote;
  const showReacts  = hasVoted || viewedReacts;
  const desc        = senti?.description ?? '';
  const truncated   = desc.length > CHAR_TRUNCATE && !expanded;
  const displayDesc = truncated ? desc.slice(0, CHAR_TRUNCATE) : desc;

  const handleViewReacts = () => {
    if (hasVoted) return;
    setShowSheet(true);
  };

  const confirmViewReacts = () => {
    setShowSheet(false);
    setViewedReacts(true);
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
          <View />
        )}

        {/* Creator avatar — tappable if onAvatarPress provided */}
        <TouchableOpacity
          style={s.avatar}
          onPress={onAvatarPress}
          activeOpacity={onAvatarPress ? 0.7 : 1}
          disabled={!onAvatarPress}
        >
          <Text style={s.avatarText}>
            {senti?.creator?.initials ?? '??'}
          </Text>
        </TouchableOpacity>
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

          <Text style={s.description}>
            {displayDesc}
            {truncated && (
              <Text style={s.seeMore} onPress={() => setExpanded(true)}>
                {' '}see more
              </Text>
            )}
            {expanded && (
              <Text style={s.seeMore} onPress={() => setExpanded(false)}>
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
  vrIcon: { fontSize: 9 },
  vrText: { fontSize: 8.5, fontWeight: '600', color: C.textPrimary },
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
  avatarText: { fontSize: 9.5, fontWeight: '700', color: C.accent },
  wavePill: { marginTop: 7, marginHorizontal: 14 },
  mainRow: {
    flex: 1,
    flexDirection: 'row',
    paddingTop: 9,
    minHeight: 0,
    overflow: 'hidden',
  },
  textCol: { flex: 1, paddingLeft: 14, overflow: 'hidden' },
  question: { fontSize: 17, fontWeight: '800', lineHeight: 22, color: C.textPrimary, marginBottom: 7 },
  questionSmall: { fontSize: 14 },
  description: { fontSize: 10.5, lineHeight: 16, color: C.textSecondary },
  seeMore: { fontSize: 10.5, fontWeight: '700', color: C.accentText },
  swellBadge: {
    marginTop: 2, marginBottom: 3, marginHorizontal: 14,
    backgroundColor: C.badgeBg, borderRadius: 20,
    paddingVertical: 3, paddingHorizontal: 10, alignSelf: 'flex-start',
  },
  swellText: { fontSize: 8.5, fontWeight: '600', color: C.badgeText },
  skipHint: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 2 },
  skipText: { fontSize: 8.5, fontWeight: '500', color: C.border },
});
