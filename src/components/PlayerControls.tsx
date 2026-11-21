import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { formatTime } from '../lib/format';
import { usePlayer } from '../lib/PlayerProvider';
import { colors, radius } from '../theme';

const SLEEP_OPTIONS = [10, 20, 30];

export function PlayerControls() {
  const p = usePlayer();
  const [barWidth, setBarWidth] = useState(0);

  const ratio = p.duration > 0 ? Math.min(1, p.position / p.duration) : 0;

  const onBarLayout = (e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width);

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="adjustable"
        accessibilityLabel="Playback position"
        onPress={(e) => {
          if (barWidth > 0 && p.duration > 0) p.seekTo((e.nativeEvent.locationX / barWidth) * p.duration);
        }}
        style={styles.barHit}
      >
        <View style={styles.bar} onLayout={onBarLayout}>
          <View style={[styles.barFill, { width: `${ratio * 100}%` }]} />
        </View>
      </Pressable>
      <View style={styles.times}>
        <Text style={styles.time}>{formatTime(p.position)}</Text>
        <Text style={styles.time}>{formatTime(p.duration)}</Text>
      </View>

      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back 15 seconds" onPress={() => p.seekBy(-15)} style={styles.skip}>
          <Text style={styles.skipText}>−15</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={p.isPlaying ? 'Pause' : 'Play'}
          onPress={p.toggle}
          style={styles.playBtn}
        >
          <Text style={styles.playText}>{p.isLoading && !p.isPlaying ? '…' : p.isPlaying ? '❚❚' : '▶'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Forward 15 seconds" onPress={() => p.seekBy(15)} style={styles.skip}>
          <Text style={styles.skipText}>+15</Text>
        </Pressable>
      </View>

      <View style={styles.sleepRow}>
        <Text style={styles.sleepLabel}>
          {p.sleepRemainingSec != null ? `Sleep in ${formatTime(p.sleepRemainingSec)}` : 'Sleep timer'}
        </Text>
        <View style={styles.sleepChips}>
          {SLEEP_OPTIONS.map((m) => (
            <Pressable
              key={m}
              accessibilityRole="button"
              accessibilityState={{ selected: p.sleepMinutes === m }}
              onPress={() => p.setSleepTimer(p.sleepMinutes === m ? null : m)}
              style={[styles.chip, p.sleepMinutes === m && styles.chipActive]}
            >
              <Text style={[styles.chipText, p.sleepMinutes === m && styles.chipTextActive]}>{m}m</Text>
            </Pressable>
          ))}
        </View>
      </View>
      {p.error ? <Text style={styles.error}>{p.error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: 12 },
  barHit: { paddingVertical: 10 },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.primary },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { color: colors.muted, fontSize: 13, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28, marginTop: 4 },
  skip: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: { fontSize: 18, fontWeight: '700', color: colors.text },
  playBtn: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playText: { fontSize: 32, color: colors.primaryText },
  sleepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  sleepLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
  sleepChips: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '600' },
  chipTextActive: { color: colors.primaryText },
  error: { color: colors.heart, fontSize: 14, textAlign: 'center' },
});
