import { Pressable, StyleSheet, View } from 'react-native';
import { useQueue } from '../lib/QueueProvider';
import { colors, radius } from '../theme';
import { ModeIcon, type ModeIconName } from './ModeIcon';

type ChipProps = {
  testName: string;
  label: string;
  icon: ModeIconName;
  selected: boolean;
  onPress: () => void;
};

/** Shuffle, Repeat all and Repeat one as an icon-only row; the selected ones get a fill plus a dot. */
export function PlaybackModeChips() {
  const { shuffle, repeat, setShuffle, setRepeat } = useQueue();

  return (
    <View style={styles.row}>
      <Chip testName="shuffle" label="Shuffle" icon="shuffle" selected={shuffle} onPress={() => setShuffle(!shuffle)} />
      <Chip
        testName="repeat-all"
        label="Repeat all"
        icon="repeat"
        selected={repeat === 'all'}
        onPress={() => setRepeat(repeat === 'all' ? 'off' : 'all')}
      />
      <Chip
        testName="repeat-one"
        label="Repeat one"
        icon="repeat-one"
        selected={repeat === 'one'}
        onPress={() => setRepeat(repeat === 'one' ? 'off' : 'one')}
      />
    </View>
  );
}

function Chip({ testName, label, icon, selected, onPress }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <ModeIcon name={icon} size={22} color={selected ? colors.primaryText : colors.text} />
      {selected ? <View testID={`chip-active-indicator-${testName}`} style={styles.dot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignSelf: 'stretch', gap: 8 },
  chip: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dot: {
    position: 'absolute',
    bottom: 4,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.primaryText,
  },
});
