import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { resolveUrl } from '../lib/catalog';
import { formatMinutes } from '../lib/format';
import { cardShadow, colors, fonts, radius } from '../theme';
import type { Story } from '../types';

/** Cover height as a share of card width: tall in portrait, shorter in landscape so titles stay visible. */
export const COVER_RATIO = { portrait: 0.78, landscape: 0.5 };
export const COVER_INSET = 8;
const TITLE_LINES = 2;
const TITLE_LINE_HEIGHT = 21;
// The button spans the meta line down to the card edge, so it never reaches into the title; hitSlop adds the rest of the 44pt target below.
const MORE_SIZE = { width: 44, height: 30 };
const MORE_HIT_SLOP = { bottom: 14 };

type Props = {
  story: Story;
  width: number;
  favorite: boolean;
  completed: boolean;
  /** Use the shorter cover so more of the card fits on a landscape screen. */
  landscape?: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
  /** Long-press opens the story actions; the accessibility actions below reach the same choices without it. */
  onLongPress?: () => void;
  onPlayNext?: () => void;
  onAddToQueue?: () => void;
};

const ACCESSIBILITY_ACTIONS = [
  { name: 'playNext', label: 'Play next' },
  { name: 'addToQueue', label: 'Add to queue' },
];

export function StoryCard({ story, width, favorite, completed, landscape = false, onPress, onToggleFavorite, onLongPress, onPlayNext, onAddToQueue }: Props) {
  const { fontScale } = useWindowDimensions();
  const coverHeight = width * (landscape ? COVER_RATIO.landscape : COVER_RATIO.portrait);
  // Always reserve two lines (scaled for Dynamic Type) so every card in the grid has the same height.
  const titleMinHeight = TITLE_LINES * TITLE_LINE_HEIGHT * fontScale;

  return (
    <View style={{ width }}>
      {/* The shadow lives on the outer view because iOS drops shadows on views that clip their content. */}
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityLabel={`${story.title}, ${formatMinutes(story.durationSec)}`}
        accessibilityActions={ACCESSIBILITY_ACTIONS}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'playNext') onPlayNext?.();
          else if (event.nativeEvent.actionName === 'addToQueue') onAddToQueue?.();
        }}
        style={({ pressed }) => [styles.card, cardShadow, pressed && { opacity: 0.85 }]}
      >
        <View style={styles.clip}>
          <View style={[styles.cover, { backgroundColor: story.color, height: coverHeight }]}>
            {story.cover ? (
              <Image source={{ uri: resolveUrl(story.cover) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <>
                <View style={[styles.dot, styles.dotA]} />
                <View style={[styles.dot, styles.dotB]} />
                <View style={[styles.dot, styles.dotC]} />
                <Text style={[styles.emoji, { fontSize: Math.min(width * 0.38, coverHeight * 0.62) }]}>{story.emoji}</Text>
              </>
            )}
            {completed ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>✓ Listened</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.body}>
            <Text style={[styles.title, { minHeight: titleMinHeight }]} numberOfLines={TITLE_LINES}>
              {story.title}
            </Text>
            <Text style={[styles.meta, onLongPress ? styles.metaClearOfMore : null]}>
              {formatMinutes(story.durationSec)} · Ages {story.ageRange}
            </Text>
          </View>
        </View>
      </Pressable>
      <Pressable
        onPress={onToggleFavorite}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={favorite ? 'Remove from favorites' : 'Add to favorites'}
        style={styles.heart}
      >
        <Text style={[styles.heartText, { color: favorite ? colors.heart : colors.muted }]}>
          {favorite ? '♥' : '♡'}
        </Text>
      </Pressable>
      {onLongPress ? (
        <Pressable
          onPress={onLongPress}
          hitSlop={MORE_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={`More actions for ${story.title}`}
          style={styles.more}
        >
          <Text style={styles.moreText} allowFontScaling={false}>
            ⋯
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.xl },
  clip: { borderRadius: radius.xl, overflow: 'hidden', padding: COVER_INSET },
  cover: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.xl - COVER_INSET, overflow: 'hidden' },
  emoji: { textAlign: 'center' },
  dot: { position: 'absolute', borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotA: { width: 6, height: 6, top: '22%', left: '16%' },
  dotB: { width: 9, height: 9, top: '14%', right: '40%' },
  dotC: { width: 6, height: 6, bottom: '20%', left: '28%' },
  body: { paddingHorizontal: 6, paddingTop: 10, paddingBottom: 6, gap: 4 },
  title: { fontFamily: fonts.rounded, fontSize: 16, lineHeight: TITLE_LINE_HEIGHT, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.muted },
  // Keeps the meta text from running under the more button at large Dynamic Type.
  metaClearOfMore: { paddingRight: MORE_SIZE.width - 6 },
  heart: {
    position: 'absolute',
    top: COVER_INSET + 8,
    right: COVER_INSET + 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartText: { fontSize: 20, lineHeight: 24 },
  more: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: MORE_SIZE.width,
    height: MORE_SIZE.height,
    paddingBottom: COVER_INSET + 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: { fontSize: 20, lineHeight: 16, color: colors.muted },
  badge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
