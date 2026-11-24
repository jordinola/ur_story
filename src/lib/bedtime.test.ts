import { endsAtFor, isExpired, parseStoredSession, remainingSec, serializeSession } from './bedtime';

describe('bedtime session logic', () => {
  it('endsAtFor adds the minutes in milliseconds', () => {
    expect(endsAtFor(30, 1000)).toBe(1000 + 30 * 60_000);
  });

  it('remainingSec rounds up and floors at zero', () => {
    expect(remainingSec(1500, 1000)).toBe(1);
    expect(remainingSec(1000, 2000)).toBe(0);
  });

  it('isExpired is true at and after endsAt and false before', () => {
    expect(isExpired(1000, 999)).toBe(false);
    expect(isExpired(1000, 1000)).toBe(true);
    expect(isExpired(1000, 1001)).toBe(true);
  });

  it('parseStoredSession round-trips serializeSession', () => {
    expect(parseStoredSession(serializeSession(123456))).toBe(123456);
  });

  it.each([
    ['null', null],
    ['bad JSON', '{nope'],
    ['wrong shape', JSON.stringify({ ends: 5 })],
    ['a string endsAt', JSON.stringify({ endsAt: '5' })],
    ['a non-finite endsAt', '{"endsAt":1e999}'],
    ['a null endsAt', JSON.stringify({ endsAt: null })],
    ['a bare number', '5'],
  ])('parseStoredSession returns null for %s', (_label, raw) => {
    expect(parseStoredSession(raw)).toBeNull();
  });
});
