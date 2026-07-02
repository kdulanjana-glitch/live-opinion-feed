// ─────────────────────────────────────────────
// Peolia — SentiCard (Scaled for real devices)
// src/components/SentiCard.jsx
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { PeoliaFonts as F , getPeoliaColors } from '../constants/peoliaTheme';
import { usePeoliaScheme } from '../context/ThemeContext';

import { fs, ms, s, vs } from '../utils/peoliaScale';
import WavePill from './WavePill';
import VoteBar from './VoteBar';
import VoteResultsPanel from './VoteResultsPanel';
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
  onShareToDM,
  onFlag,
  onAvatarPress,
  onViewLocked,
  liked  = false,   // ← true when user has liked this senti
  pinned = false,   // ← true when user has pinned this senti
  userVote = null,
  userViewedReacts = false,
}) {
  const scheme = usePeoliaScheme();
  const C = getPeoliaColors(scheme);
  const s_ = makeStyles(C);

  const [expanded,     setExpanded]    = useState(false);
  const [showSheet,    setShowSheet]   = useState(false);
  const [viewedReacts, setViewedReacts] = useState(userViewedReacts);
  const [resultsOpen,  setResultsOpen] = useState(false);

  const hasVoted    = !!userVote;
  const desc        = senti?.description ?? '';
  const truncated   = desc.length > CHAR_TRUNCATE && !expanded;
  const displayDesc = truncated ? desc.slice(0, CHAR_TRUNCATE) : desc;
  const hasImage    = !!senti?.imageUrl;

  // Eye tap for a not-yet-voted user → the view-reacts gate (ViewReactsSheet).
  // Once unlocked (or already viewed), it just toggles the results panel.
  const handleViewReacts = () => {
    if (viewedReacts) { setResultsOpen((prev) => !prev); return; }
    setShowSheet(true);
  };

  return (
    <View style={s_.card}>

      {/* Full-bleed senti image + dark overlay (text switches to light) */}
      {hasImage && (
        <>
          <Image
            source={{ uri: senti.imageUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
          <View style={s_.imageOverlay} />
        </>
      )}

      {/* Content layer — zIndex lifts it above the absolute image/overlay.
          Android does NOT reliably honor paint order here (same reason the
          FloatScreen preview puts zIndex:1 on every element over its image). */}
      <View style={s_.content}>

      {/* Top row — wave pill (left) + creator avatar (right) */}
      <View style={s_.topRow}>
        <WavePill wave={senti?.wave ?? 'Tech'} transparent={hasImage} />

        <TouchableOpacity
          style={s_.avatar}
          onPress={onAvatarPress}
          activeOpacity={onAvatarPress ? 0.7 : 1}
          disabled={!onAvatarPress}
        >
          {senti?.creator?.avatarUrl ? (
            <Image source={{ uri: senti.creator.avatarUrl }} style={s_.avatarImg} resizeMode="cover" />
          ) : (
            <Text style={s_.avatarText}>{senti?.creator?.initials ?? '?'}</Text>
          )}
        </TouchableOpacity>
      </View>

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

          {/* Swell / Rare badge — right after the description */}
          {hasVoted && (
            <View style={s_.swellBadge}>
              <Text style={s_.swellText}>
                {userVote === 'yes' && "You said Yes · You're in the swell 🌊"}
                {userVote === 'hmm' && "You said Hmm · You're still thinking 🤔"}
                {userVote === 'nah' && "You said Nah · You're one of The Rare ✨"}
              </Text>
            </View>
          )}
        </View>
        <ActionBar
          likes={senti?.likes}   voices={senti?.voices}  pins={senti?.pins}
          liked={liked}
          pinned={pinned}
          onImage={hasImage}
          hasVoted={hasVoted}
          resultsOpen={resultsOpen}
          onToggleResults={() => {
            if (!hasVoted) { handleViewReacts(); return; }
            setResultsOpen((prev) => !prev);
          }}
          onLike={() => onLike?.(senti?.id)}   onVoice={() => onVoice?.(senti?.id)}
          onPin={() => onPin?.(senti?.id)}     onAsk={() => onAsk?.(senti?.id)}
          onAskLongPress={onShareToDM ? () => onShareToDM(senti?.id) : undefined}
          onFlag={() => onFlag?.(senti?.id)}
        />
      </View>

      {/* Results panel (toggled by the eye) sits directly above the vote bar */}
      <VoteResultsPanel visible={resultsOpen} results={senti?.results} />

      {/* Vote bar */}
      <VoteBar
        voted={hasVoted ? userVote : null}
        onVote={(choice) => onVote?.(senti?.id, choice)}
      />

      </View>{/* end content layer */}

      <ViewReactsSheet
        visible={showSheet}
        onCancel={() => setShowSheet(false)}
        onConfirm={() => {
          setShowSheet(false);
          setViewedReacts(true);
          setResultsOpen(true);   // reveal the results panel right after unlocking
          onViewLocked?.();       // ← bubble up so screen can persist to senti_view_locks
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
    paddingTop: vs(48),
    minHeight: vs(40),
  },
  avatar: {
    width: s(40),
    height: s(40),
    borderRadius: s(20),
    backgroundColor: C.accent,   // solid circle + white letter — same as ProfileScreen
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg:    { width: '100%', height: '100%' },   // fill parent (matches working preset tiles)
  avatarText:   { letterSpacing: -0.2, fontSize: fs(17), fontFamily: F.extraBold, color: '#FFFFFF' },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.48)',   // matches FloatScreen preview overlay
  },
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
    letterSpacing: -0.2, fontSize: fs(26),        // was fs(21) → ×1.25
    fontFamily: F.extraBold,
    lineHeight: fs(28),
    color: C.textPrimary,
    marginBottom: vs(8),
  },
  questionSmall:   { fontFamily: F.regular, fontSize: fs(21) },  // was fs(17) → ×1.25
  questionOnImage: { color: '#FFFFFF' },
  description: {
    fontFamily: F.regular, fontSize: fs(19),        // was fs(15) → ×1.25
    lineHeight: fs(23),
    color: C.textSecondary,
  },
  descriptionOnImage: { color: 'rgba(255,255,255,0.72)' },  // matches preview
  seeMore: {
    fontSize: fs(19),        // was fs(15) → ×1.25
    fontFamily: F.bold,
    color: C.accentText,
  },
  seeMoreOnImage: { color: '#C7D2FE' },
  swellBadge: {
    marginTop: vs(10),
    backgroundColor: C.badgeBg,
    borderRadius: ms(20),
    paddingVertical: vs(6),
    paddingHorizontal: ms(14),
    alignSelf: 'flex-start',
  },
  swellText:  { fontSize: fs(14), fontFamily: F.semiBold, color: C.badgeText },
});
