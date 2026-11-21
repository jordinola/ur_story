import { colors } from './theme';

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('theme colors', () => {
  it.each([
    ['text on background', colors.text, colors.bg],
    ['text on card', colors.text, colors.card],
    ['muted text on card', colors.muted, colors.card],
    ['muted text on background', colors.muted, colors.bg],
    ['button label on primary', colors.primaryText, colors.primary],
  ])('keeps %s at WCAG AA (4.5:1)', (_name, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the primary button distinguishable from the background (3:1)', () => {
    expect(contrast(colors.primary, colors.bg)).toBeGreaterThanOrEqual(3);
  });
});
