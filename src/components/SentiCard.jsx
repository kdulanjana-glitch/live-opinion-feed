// ─────────────────────────────────────────────
// Peolia — SentiCard (Scaled for real devices)
// src/components/SentiCard.jsx
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { getPeoliaColors } from '../constants/peoliaTheme';
import { fs, ms, s, vs } from '../utils/peoliaScale';
import WavePill from './WavePill';
import VoteBar from './VoteBar';
import ActionBar from './ActionBar';
import ViewReactsSheet from './ViewReactsSheet';

const CHAR_TRUNCATE = 200;

export default function SentiCard({
  senti,
  onVote,
  onLike,
  onVoice,
  onPin,
  onAsk,
  onAvatarPress,
  onViewLocked,
  liked  = false,   // ← true when user has liked this senti
  pinned = false,   // ← true when user has pinned this senti
  userVote = null,
  userViewedReacts = false,
}) {
  const scheme = useColorScheme();
  const C = getPeoliaColors(scheme);
  const s_ = makeStyles(C);

  const [expanded,     setExpanded]    = useState(false);
  const [showSheet,    setShowSheet]   = useState(false);
  const [viewedReacts, setViewedReacts] = useState(userViewedReacts);

  const hasVoted    = !!userVote;
  const showReacts  = hasVoted || viewedReacts;
  const desc        = senti?.description ?? '';
  const truncated   = desc.length > CHAR_TRUNCATE && !expanded;
  const displayDesc = truncated ? desc.slice(0, CHAR_TRUNCATE) : desc;

  return (
    <View style={s_.card}>

      {/* Top row */}
      <View style={s_.topRow}>
        {!hasVoted ? (
          <TouchableOpacity style={s_.vrBtn} onPress={() => setShowSheet(true)} activeOpacity={0.7}>
            <Text style={s_.vrIcon}>👁</Text>
            <Text style={s_.vrText}>View reacts</Text>
          </TouchableOpacity>
        ) : <View />}

        <TouchableOpacity
          style={s_.avatar}
          onPress={onAvatarPress}
          activeOpacity={onAvatarPress ? 0.7 : 1}
          disabled={!onAvatarPress}
        >
          <Text style={s_.avatarText}>{senti?.creator?.initials ?? '??'}</Text>
        </TouchableOpacity>
      </View>

      {/* Wave pill */}
      <WavePill wave={senti?.wave ?? 'Tech'} style={s_.wavePill} />

      {/* Main row */}
      <View style={s_.mainRow}>
        <View style={s_.textCol}>
          <Text style={[s_.question, expanded && s_.questionSmall]}>
            {senti?.question ?? ''}
          </Text>
          <Text style={s_.description}>
            {displayDesc}
            {truncated && <Text style={s_.seeMore} onPress={() => setExpanded(true)}> see more</Text>}
            {expanded  && <Text style={s_.seeMore} onPress={() => setExpanded(false)}> see less</Text>}
          </Text>
        </View>
        <ActionBar
          likes={senti?.likes}   voices={senti?.voices}  pins={senti?.pins}
          liked={liked}
          pinned={pinned}
          onLike={() => onLike?.(senti?.id)}   onVoice={() => onVoice?.(senti?.id)}
          onPin={() => onPin?.(senti?.id)}     onAsk={() => onAsk?.(senti?.id)}
        />
      </View>

      {/* Swell badge */}
      {hasVoted && (
        <View style={s_.swellBadge}>
          <Text style={s_.swellText}>
            {userVote === 'yes' && "You said Yes · You're in the swell 🌊"}
            {userVote === 'hmm' && "You said Hmm · You're still thinking 🤔"}
            {userVote === 'nah' && "You said Nah · You're one of The Rare ✨"}
          </Text>
        </View>
      )}

      {/* Vote bar */}
      <VoteBar
        voted={hasVoted ? userVote : null}
        results={showReacts ? senti?.results : null}
        onVote={(choice) => onVote?.(senti?.id, choice)}
      />

      <ViewReactsSheet
        visible={showSheet}
        onCancel={() => setShowSheet(false)}
        onConfirm={() => {
          setShowSheet(false);
          setViewedReacts(true);
          onViewLocked?.();   // ← bubble up so screen can persist to senti_view_locks
        }}
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
    paddingHorizontal: ms(16),
    paddingTop: vs(10),
    minHeight: vs(40),
  },
  vrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(5),
    paddingVertical: vs(7),
    paddingHorizontal: ms(14),
    borderRadius: ms(20),
    backgroundColor: C.surfaceAlt,
    borderWidth: 0.5,
    borderColor: C.borderStrong,
  },
  vrIcon:       { fontSize: fs(15) },
  vrText:       { fontSize: fs(15), fontWeight: '600', color: C.textPrimary },
  avatar: {
    width: s(40),
    height: s(40),
    borderRadius: s(20),
    backgroundColor: C.accentLight,
    borderWidth: 1.5,
    borderColor: C.accentMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText:   { fontSize: fs(15), fontWeight: '700', color: C.accent },
  wavePill:     { marginTop: vs(8), marginHorizontal: ms(16) },
  mainRow: {
    flex: 1,
    flexDirection: 'row',
    paddingTop: vs(10),
    minHeight: 0,
    overflow: 'hidden',
  },
  textCol: {
    flex: 1,
    paddingLeft: ms(16),
    paddingRight: ms(4),
    overflow: 'hidden',
  },
  question: {
    fontSize: fs(26),        // was fs(21) → ×1.25
    fontWeight: '800',
    lineHeight: fs(28),
    color: C.textPrimary,
    marginBottom: vs(8),
  },
  questionSmall: { fontSize: fs(21) },  // was fs(17) → ×1.25
  description: {
    fontSize: fs(19),        // was fs(15) → ×1.25
    lineHeight: fs(23),
    color: C.textSecondary,
  },
  seeMore: {
    fontSize: fs(19),        // was fs(15) → ×1.25
    fontWeight: '700',
    color: C.accentText,
  },
  swellBadge: {
    marginTop: vs(4),
    marginBottom: vs(2),
    marginHorizontal: ms(16),
    backgroundColor: C.badgeBg,
    borderRadius: ms(20),
    paddingVertical: vs(6),
    paddingHorizontal: ms(14),
    alignSelf: 'flex-start',
  },
  swellText:  { fontSize: fs(14), fontWeight: '600', color: C.badgeText },
});
