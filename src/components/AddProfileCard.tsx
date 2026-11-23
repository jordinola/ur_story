import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cardShadow, colors, fonts, radius } from '../theme';

type Props = { onPress: () => void };

export function AddProfileCard({ onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add a kid profile"
      onPress={onPress}
      style={({ pressed }) => [styles.card, cardShadow, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.badge} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Text style={styles.plus}>+</Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>Add a kid profile</Text>
        <Text style={styles.helper}>Get stories picked just for them</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 44,
    padding: 14,
    marginBottom: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  plus: { color: colors.primaryText, fontSize: 26, fontWeight: '700', lineHeight: 30 },
  copy: { flex: 1 },
  title: { color: colors.text, fontFamily: fonts.rounded, fontSize: 17, fontWeight: '800' },
  helper: { color: colors.muted, fontSize: 14, marginTop: 2 },
});
