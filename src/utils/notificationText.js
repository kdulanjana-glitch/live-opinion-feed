// ─────────────────────────────────────────────
// Peolia — notificationText
// src/utils/notificationText.js
//
// Shared text-building logic so NotificationListScreen and NotificationToast
// never drift out of sync. getNotificationLine returns a STRUCTURED object
// (prefix / reaction / suffix) so callers can color the reaction word in its
// vote color while the rest stays normal text.
// ─────────────────────────────────────────────

// display_name primary, @username secondary, 'A citizen' fallback.
export const getActorName = (actor) => {
  const dn = actor?.display_name;
  if (dn && dn.trim()) return dn.trim();
  if (actor?.username) return `@${actor.username}`;
  return 'A citizen';
};

export const getNotificationLine = (notification) => {
  const name = getActorName(notification?.actor);
  switch (notification?.type) {
    case 'react':
      return { prefix: `${name} reacted `, reaction: notification.reaction, suffix: ' to your senti' };
    case 'voice':
      return { prefix: `${name} voiced on your senti`, reaction: null, suffix: '' };
    case 'reply':
      return { prefix: `${name} replied to your voice`, reaction: null, suffix: '' };
    case 'follow':
      return { prefix: `${name} is following you`, reaction: null, suffix: '' };
    case 'warning':
      return { prefix: 'Your senti was removed for violating community guidelines', reaction: null, suffix: '' };
    default:
      return { prefix: name, reaction: null, suffix: '' };
  }
};

export const getReactionColor = (reaction, C) => {
  if (reaction === 'yes') return C.yesText;
  if (reaction === 'hmm') return C.hmmText;
  if (reaction === 'nah') return C.nahText;
  return C.textPrimary;
};

// 'yes' → 'Yes' etc. for display.
export const reactionLabel = (reaction) =>
  reaction === 'yes' ? 'Yes' : reaction === 'hmm' ? 'Hmm' : reaction === 'nah' ? 'Nah' : '';
