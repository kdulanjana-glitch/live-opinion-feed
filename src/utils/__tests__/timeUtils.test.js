// Tests for relative/clock time helpers.
import { relativeTime, clockTime } from '../timeUtils';

describe('relativeTime', () => {
  const NOW = new Date('2026-07-01T12:00:00Z').getTime();   // a Wednesday
  beforeEach(() => { jest.spyOn(Date, 'now').mockReturnValue(NOW); });
  afterEach(() => { jest.restoreAllMocks(); });

  test('empty / invalid input → empty string', () => {
    expect(relativeTime(null)).toBe('');
    expect(relativeTime('not-a-date')).toBe('');
  });
  test('< 60s → "now"', () => {
    expect(relativeTime(new Date(NOW - 30 * 1000).toISOString())).toBe('now');
  });
  test('< 60m → minutes', () => {
    expect(relativeTime(new Date(NOW - 5 * 60 * 1000).toISOString())).toBe('5m');
    expect(relativeTime(new Date(NOW - 59 * 60 * 1000).toISOString())).toBe('59m');
  });
  test('< 24h → hours', () => {
    expect(relativeTime(new Date(NOW - 3 * 3600 * 1000).toISOString())).toBe('3h');
    expect(relativeTime(new Date(NOW - 23 * 3600 * 1000).toISOString())).toBe('23h');
  });
  test('>= 24h → weekday name', () => {
    // 2 days before Wed 2026-07-01 = Mon 2026-06-29
    expect(relativeTime(new Date(NOW - 48 * 3600 * 1000).toISOString())).toBe('Mon');
  });
});

describe('clockTime', () => {
  test('empty / invalid input → empty string', () => {
    expect(clockTime(null)).toBe('');
    expect(clockTime('nope')).toBe('');
  });
  test('formats a valid timestamp to a time string', () => {
    const out = clockTime('2026-07-01T15:07:00');
    expect(out).toMatch(/3:07|15:07/);   // locale-dependent 12h/24h
  });
});
