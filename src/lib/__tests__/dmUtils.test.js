// Tests for the pure DM helpers (no supabase client involved).
import {
  getMyUnreadCount,
  getLastMessagePreview,
  dmInitials,
  isMuted,
  MUTE_OPTIONS,
} from '../dmUtils';

describe('getMyUnreadCount', () => {
  const conv = { participant_1_id: 'aaa', participant_2_id: 'bbb', unread_p1: 3, unread_p2: 7 };

  test('returns unread_p1 when I am participant 1', () => {
    expect(getMyUnreadCount(conv, 'aaa')).toBe(3);
  });
  test('returns unread_p2 when I am participant 2', () => {
    expect(getMyUnreadCount(conv, 'bbb')).toBe(7);
  });
  test('null conversation → 0', () => {
    expect(getMyUnreadCount(null, 'aaa')).toBe(0);
  });
  test('missing counters → 0', () => {
    expect(getMyUnreadCount({ participant_1_id: 'aaa' }, 'aaa')).toBe(0);
  });
});

describe('getLastMessagePreview', () => {
  test('no message → empty string', () => {
    expect(getLastMessagePreview(null, 'me')).toBe('');
  });
  test('deleted-for-all → placeholder', () => {
    expect(getLastMessagePreview({ deleted_for_all: true, body: 'hi' }, 'me')).toBe('Message deleted');
  });
  test('image-only → photo label', () => {
    expect(getLastMessagePreview({ image_path: 'x/y.jpg', body: null }, 'me')).toBe('📷 Photo');
  });
  test('image WITH caption → shows the caption', () => {
    expect(getLastMessagePreview({ image_path: 'x/y.jpg', body: 'look!' }, 'me')).toBe('look!');
  });
  test('long body truncates to 40 chars + ellipsis', () => {
    const body = 'a'.repeat(60);
    const out = getLastMessagePreview({ body }, 'me');
    expect(out).toBe('a'.repeat(40) + '...');
  });
  test('short body passes through unchanged', () => {
    expect(getLastMessagePreview({ body: 'hey' }, 'me')).toBe('hey');
  });
});

describe('dmInitials', () => {
  test('uses avatar_initials when present and not stale', () => {
    expect(dmInitials({ avatar_initials: 'KD' })).toBe('KD');
  });
  test('skips the stale "??" sentinel', () => {
    expect(dmInitials({ avatar_initials: '??', display_name: 'Kasun' })).toBe('K');
  });
  test('falls back display_name → username → ?', () => {
    expect(dmInitials({ display_name: 'zara', username: 'ignored' })).toBe('Z');
    expect(dmInitials({ display_name: '  ', username: 'bob' })).toBe('B');
    expect(dmInitials({})).toBe('?');
    expect(dmInitials(null)).toBe('?');
  });
});

describe('isMuted / MUTE_OPTIONS', () => {
  test('no pref or no muted_until → not muted', () => {
    expect(isMuted(null)).toBe(false);
    expect(isMuted({})).toBe(false);
    expect(isMuted({ muted_until: null })).toBe(false);
  });
  test('future muted_until → muted', () => {
    expect(isMuted({ muted_until: new Date(Date.now() + 60000).toISOString() })).toBe(true);
  });
  test('past muted_until → mute expired', () => {
    expect(isMuted({ muted_until: new Date(Date.now() - 60000).toISOString() })).toBe(false);
  });
  test('MUTE_OPTIONS produce future timestamps ordered day < week < always', () => {
    const day = new Date(MUTE_OPTIONS.day()).getTime();
    const week = new Date(MUTE_OPTIONS.week()).getTime();
    const always = new Date(MUTE_OPTIONS.always()).getTime();
    expect(day).toBeGreaterThan(Date.now());
    expect(week).toBeGreaterThan(day);
    expect(always).toBeGreaterThan(week);
  });
});
