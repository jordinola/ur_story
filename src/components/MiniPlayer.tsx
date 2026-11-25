import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayer } from '../lib/PlayerProvider';
import { cardShadow, colors, fonts, radius } from '../theme';
import { MarqueeText } from './MarqueeText';
import { UpNextBanner } from './UpNextBanner';

/** Compact now-playing bar shown on every screen except the story screen. */
export function MiniPlayer() {
  const p = usePlayer();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  if (!p.current || pathname.startsWith('/story/')) return null;

  const ratio = p.duration > 0 ? Math.min(1, p.position / p.duration) : 0;

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingBottom: Math.max(insets.bottom, 8),
          paddingLeft: Math.max(insets.left, 12),
          paddingRight: Math.max(insets.right, 12),
        },
      ]}
    >
      <View style={[styles.pill, cardShadow]}>
        <View style={styles.clip}>
          <View style={styles.progress}>
            <View style={[styles.progressFill, { width: `${ratio * 100}%` }]} />
          </View>
          <View style={styles.row}>
            <Pressable
              style={styles.info}
              accessibilityRole="button"
              accessibilityLabel={`Open ${p.current.title}`}
              onPress={() => router.push({ pathname: '/story/[id]', params: { id: p.current!.id } })}
            >
              <Text style={styles.emoji}>{p.current.emoji}</Text>
              <View style={styles.titleWrap}>
                <MarqueeText style={styles.title}>{p.current.title}</MarqueeText>
              </View>
            </Pressable>
            <Pressable
              onPress={p.toggle}
              accessibilityRole="button"
              accessibilityLabel={p.isPlaying ? 'Pause' : 'Play'}
              style={styles.btn}
            >
              <Text style={styles.btnText}>{p.isPlaying ? '❚❚' : '▶'}</Text>
            </Pressable>
          </View>
          <UpNextBanner />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 4 },
  pill: { backgroundColor: colors.card, borderRadius: radius.xl },
  clip: { borderRadius: radius.xl, overflow: 'hidden' },
  progress: { height: 4, backgroundColor: colors.border },
  progressFill: { height: '100%', backgroundColor: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingLeft: 16, paddingRight: 10, gap: 12 },
  info: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  emoji: { fontSize: 26 },
  titleWrap: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.rounded, fontSize: 16, fontWeight: '700', color: colors.text },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: colors.primaryText, fontSize: 16 },
});
