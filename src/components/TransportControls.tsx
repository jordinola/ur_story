import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { formatTime } from '../lib/format';
import { usePlayer } from '../lib/PlayerProvider';
import { useQueue } from '../lib/QueueProvider';
import { cardShadow, colors } from '../theme';
import { TransportIcon } from './TransportIcon';

export function TransportControls() {
  const p = usePlayer();
  const { canNext, playNextNow, playPrevious } = useQueue();
  const [barWidth, setBarWidth] = useState(0);

  const ratio = p.duration > 0 ? Math.min(1, p.position / p.duration) : 0;

  const onBarLayout = (e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width);

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="adjustable"
        accessibilityLabel="Playback position"
        accessibilityValue={{ text: `${formatTime(p.position)} of ${formatTime(p.duration)}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment') p.seekBy(SEEK_STEP_SEC);
          else if (e.nativeEvent.actionName === 'decrement') p.seekBy(-SEEK_STEP_SEC);
        }}
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous story"
          onPress={playPrevious}
          style={styles.skip}
        >
          <TransportIcon name="previous" size={SKIP_ICON_SIZE} color={colors.text} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={p.isPlaying ? 'Pause' : 'Play'}
          onPress={p.toggle}
          style={styles.playBtn}
        >
          {p.isLoading && !p.isPlaying ? (
            <Text style={styles.playText} allowFontScaling={false}>
              …
            </Text>
          ) : (
            <TransportIcon name={p.isPlaying ? 'pause' : 'play'} size={PLAY_ICON_SIZE} color={colors.primaryText} />
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next story"
          accessibilityState={canNext ? undefined : { disabled: true }}
          onPress={canNext ? playNextNow : undefined}
          style={[styles.skip, !canNext && styles.disabled]}
        >
          <TransportIcon name="next" size={SKIP_ICON_SIZE} color={colors.text} />
        </Pressable>
      </View>
      {p.error ? <Text style={styles.error}>{p.error}</Text> : null}
    </View>
  );
}

const SEEK_STEP_SEC = 15;
const SKIP_ICON_SIZE = 22;
const PLAY_ICON_SIZE = 28;

// Widths 48+72+48 = 168pt plus two 26pt gaps = 220pt, inside the 280pt a 320pt iPhone leaves after 20pt side padding.
const styles = StyleSheet.create({
  wrap: { width: '100%', gap: 12 },
  barHit: { paddingVertical: 10 },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.primary },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { color: colors.muted, fontSize: 13, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 26, marginTop: 4 },
  skip: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },
  disabled: { opacity: 0.4 },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },
  playText: { fontSize: 28, color: colors.primaryText },
  error: { color: colors.heart, fontSize: 14, textAlign: 'center' },
});
