// ─────────────────────────────────────────────
// Peolia — SentiCard (Scaled for real devices)
// src/components/SentiCard.jsx
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { Image } from 'expo-image';
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
  const hasImage    = !!senti?.imageUrl;

  return (
    <View style={s_.card}>

      {/* Full-bleed senti image + dark overlay (text switches to light) */}
      {hasImage && (
        <>
          <Image
            source={{ uri: senti.imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={150}
          />
          <View style={s_.imageOverlay} />
        </>
      )}

      {/* Content layer — zIndex lifts it above the absolute image/overlay.
          Android does NOT reliably honor paint order here (same reason the
          FloatScreen preview puts zIndex:1 on every element over its image). */}
      <View style={s_.content}>

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
          {senti?.creator?.avatarUrl ? (
            <Image source={{ uri: senti.creator.avatarUrl }} style={s_.avatarImg} contentFit="cover" />
          ) : (
            <Text style={s_.avatarText}>{senti?.creator?.initials ?? '?'}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Wave pill */}
      <WavePill wave={senti?.wave ?? 'Tech'} transparent={hasImage} style={s_.wavePill} />

      {/* Main row */}
      <View style={s_.mainRow}>
        <View style={s_.textCol}>
          <Text style={[s_.question, expanded && s_.questionSmall, hasImage && s_.questionOnImage]}>
            {senti?.question ?? ''}
          </Text>
          <Text style={[s_.description, hasImage && s_.descriptionOnImage]}>
            {displayDesc}
            {truncated && <Text style={[s_.seeMore, hasImage && s_.seeMoreOnImage]} onPress={() => setExpanded(true)}> see more</Text>}
            {expanded  && <Text style={[s_.seeMore, hasImage && s_.seeMoreOnImage]} onPress={() => setExpanded(false)}> see less</Text>}
          </Text>
        </View>
        <ActionBar
          likes={senti?.likes}   voices={senti?.voices}  pins={senti?.pins}
          liked={liked}
          pinned={pinned}
          onImage={hasImage}
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

      </View>{/* end content layer */}

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
  content: {
    flex: 1,
    zIndex: 1,   // sit above the full-bleed image + overlay (Android paint-order fix)
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
    backgroundColor: C.accent,   // solid circle + white letter — same as ProfileScreen
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg:    { width: s(40), height: s(40), borderRadius: s(20) },
  avatarText:   { fontSize: fs(17), fontWeight: '800', color: '#FFFFFF' },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.48)',   // matches FloatScreen preview overlay
  },
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
  questionSmall:   { fontSize: fs(21) },  // was fs(17) → ×1.25
  questionOnImage: { color: '#FFFFFF' },
  description: {
    fontSize: fs(19),        // was fs(15) → ×1.25
    lineHeight: fs(23),
    color: C.textSecondary,
  },
  descriptionOnImage: { color: 'rgba(255,255,255,0.72)' },  // matches preview
  seeMore: {
    fontSize: fs(19),        // was fs(15) → ×1.25
    fontWeight: '700',
    color: C.accentText,
  },
  seeMoreOnImage: { color: '#C7D2FE' },
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
