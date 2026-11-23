import { StyleSheet, Text, View } from 'react-native';
import { getInitials } from '../lib/profiles';
import { colors, fonts } from '../theme';

type Props = { name?: string; color?: string; size?: number };

/**
 * Initials on the profile color, or a person glyph when there is no name. Without a profile color it
 * sits on the muted neutral, so "no profile" never looks like a kid's color. Decorative: parents label it.
 */
export function Avatar({ name, color = colors.muted, size = 36 }: Props) {
  const initials = name ? getInitials(name) : '';
  const circle = { width: size, height: size, borderRadius: size / 2, backgroundColor: color };
  return (
    <View
      testID="avatar"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.circle, circle]}
    >
      {initials ? (
        <Text style={[styles.initials, { fontSize: size * 0.4 }]} maxFontSizeMultiplier={1.2}>
          {initials}
        </Text>
      ) : (
        <View testID="avatar-glyph" style={styles.glyph}>
          <View
            style={{
              width: size * 0.26,
              height: size * 0.26,
              borderRadius: size * 0.13,
              backgroundColor: colors.primaryText,
            }}
          />
          <View
            style={{
              width: size * 0.46,
              height: size * 0.22,
              marginTop: size * 0.04,
              borderTopLeftRadius: size * 0.23,
              borderTopRightRadius: size * 0.23,
              backgroundColor: colors.primaryText,
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: colors.primaryText, fontFamily: fonts.rounded, fontWeight: '800' },
  glyph: { alignItems: 'center', justifyContent: 'center' },
});
