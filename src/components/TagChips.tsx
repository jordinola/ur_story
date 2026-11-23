import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../theme';

type Props = {
  label: string;
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** Maps an option value to its visible label (defaults to the value itself). */
  getLabel?: (option: string) => string;
  disabled?: boolean;
};

/** Multi-select chips. Each chip is a toggle button exposing its selected state. */
export function TagChips({ label, options, selected, onChange, getLabel = (o) => o, disabled = false }: Props) {
  const toggle = (option: string) =>
    onChange(selected.includes(option) ? selected.filter((s) => s !== option) : [...selected, option]);

  return (
    <View accessibilityRole="none" style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        {options.map((option) => {
          const isSelected = selected.includes(option);
          const text = getLabel(option);
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityLabel={text}
              accessibilityState={{ selected: isSelected, disabled }}
              disabled={disabled}
              onPress={() => toggle(option)}
              style={[styles.chip, isSelected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{text}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  label: { color: colors.text, fontFamily: fonts.rounded, fontSize: 17, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  chipTextSelected: { color: colors.primaryText },
});
