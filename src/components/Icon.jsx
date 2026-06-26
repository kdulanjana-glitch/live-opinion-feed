// ─────────────────────────────────────────────
// Peolia — Icon
// src/components/Icon.jsx
//
// Thin wrapper over @expo/vector-icons (Feather). Specs reference Tabler-style
// "ti-*" names; this maps each one we use to its Feather equivalent so call
// sites can stay declarative: <Icon name="ti-bell" size={fs(16)} color={C.accent} />
// ─────────────────────────────────────────────

import React from 'react';
import { Feather } from '@expo/vector-icons';

// ti-* → Feather glyph name
const MAP = {
  'ti-phone':           'phone',
  'ti-mail':            'mail',
  'ti-chevron-left':    'chevron-left',
  'ti-chevron-right':   'chevron-right',
  'ti-calendar':        'calendar',
  'ti-star':            'star',
  'ti-user':            'user',
  'ti-user-circle':     'user',
  'ti-clock':           'clock',
  'ti-bell':            'bell',
  'ti-message-2':       'message-square',
  'ti-message-circle':  'message-circle',
  'ti-dots-vertical':   'more-vertical',
  'ti-settings':        'settings',
  'ti-help-circle':     'help-circle',
  'ti-logout':          'log-out',
  'ti-heart':           'heart',
  'ti-thumbs-down':     'thumbs-down',
  'ti-pin':             'bookmark',
  'ti-x':               'x',
  'ti-check':           'check',
  'ti-moon':            'moon',
  'ti-sun':             'sun',
  'ti-device-mobile':   'smartphone',
  'ti-key':             'key',
  'ti-at':              'at-sign',
  'ti-lock':            'lock',
  'ti-shield':          'shield',
  'ti-alert-triangle':  'alert-triangle',
  'ti-trash':           'trash-2',
  'ti-ban':             'slash',
  'ti-send':            'send',
  'ti-photo':           'image',
  'ti-edit':            'edit-2',
  'ti-search':          'search',
};

export default function Icon({ name, size, color, style }) {
  const glyph = MAP[name] ?? name;
  return <Feather name={glyph} size={size} color={color} style={style} />;
}
