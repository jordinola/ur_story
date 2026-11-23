import { Platform, type ViewStyle } from 'react-native';

/** "Sunny Meadow": warm cream, coral buttons, teal accent. Text and button pairs pass WCAG AA. */
export const colors = {
  bg: '#FFF5E6',
  card: '#FFFFFF',
  text: '#3A2E39',
  muted: '#74636F',
  primary: '#C2410C',
  primaryText: '#FFFFFF',
  accent: '#2EC4B6',
  border: '#F3DFC2',
  heart: '#E5484D',
  /** Tint for soft drop shadows under cards, so they read warm instead of grey. */
  shadow: '#C2410C',
};

/** Profile avatar backgrounds. Each passes WCAG AA (4.5:1) under white initials. */
export const avatarColors: string[] = ['#1D4ED8', '#B91C1C', '#047857', '#7E22CE', '#C2410C', '#0E7490'];

/** Spoken names for `avatarColors`, index for index (VoiceOver labels for the color swatches). */
export const avatarColorNames: string[] = ['Blue', 'Red', 'Green', 'Purple', 'Orange', 'Teal'];

export const radius = { sm: 10, md: 16, lg: 24, xl: 28, pill: 999 };

/** iOS rounded system font for a friendlier look. Other platforms keep their default font. */
export const fonts = {
  rounded: Platform.select({ ios: 'ui-rounded', default: undefined }),
};

/** Soft, tinted lift for floating surfaces (cards, mini-player, round buttons). */
export const cardShadow: ViewStyle = {
  shadowColor: colors.shadow,
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.22,
  shadowRadius: 14,
  elevation: 5,
};

/** Keeps content readable on large iPad screens. */
export const MAX_CONTENT_WIDTH = 1100;
