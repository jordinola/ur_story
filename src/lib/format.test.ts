import { formatMinutes, formatTime } from './format';

describe('formatTime', () => {
  it.each([
    [0, '0:00'],
    [5, '0:05'],
    [65, '1:05'],
    [600, '10:00'],
    [3725, '62:05'],
  ])('formats %d seconds as %s', (input, expected) => {
    expect(formatTime(input)).toBe(expected);
  });

  it('floors fractional seconds', () => {
    expect(formatTime(59.9)).toBe('0:59');
  });

  it('clamps negative values to zero', () => {
    expect(formatTime(-12)).toBe('0:00');
  });
});

describe('formatMinutes', () => {
  it.each([
    [300, '5 min'],
    [420, '7 min'],
    [89, '1 min'],
    [90, '2 min'],
  ])('formats %d seconds as %s', (input, expected) => {
    expect(formatMinutes(input)).toBe(expected);
  });

  it('never goes below 1 minute', () => {
    expect(formatMinutes(0)).toBe('1 min');
    expect(formatMinutes(10)).toBe('1 min');
  });
});
