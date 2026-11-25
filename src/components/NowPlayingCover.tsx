import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { resolveUrl } from '../lib/catalog';
import { formatTime } from '../lib/format';
import { usePlayer } from '../lib/PlayerProvider';
import { cardShadow, colors, fonts, radius } from '../theme';
import type { Story } from '../types';

const COMPACT_COVER_SIZE = 56;

type NowPlayingCoverProps = {
  story: Story;
  size: number;
  compact: boolean;
  onToggle: () => void;
};

/** The story's cover: big in the cover view, a compact row (cover, title, time) in the queue view. */
export function NowPlayingCover({ story, size, compact, onToggle }: NowPlayingCoverProps) {
  if (compact) return <CompactRow story={story} onToggle={onToggle} />;

  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Show queue" onPress={onToggle}>
      <CoverArt story={story} size={size} rounded={radius.xl} />
    </Pressable>
  );
}

function CompactRow({ story, onToggle }: { story: Story; onToggle: () => void }) {
  const p = usePlayer();

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${story.title}, show cover`} onPress={onToggle} style={styles.row}>
      <CoverArt story={story} size={COMPACT_COVER_SIZE} rounded={radius.md} />
      <View style={styles.rowText}>
        <Text style={styles.title} numberOfLines={1}>
          {story.title}
        </Text>
        <Text style={styles.time}>{`${formatTime(p.position)} / ${formatTime(p.duration)}`}</Text>
      </View>
    </Pressable>
  );
}

// Shadow sits on the outer view because iOS drops shadows on views that clip their content.
function CoverArt({ story, size, rounded }: { story: Story; size: number; rounded: number }) {
  return (
    <View style={[styles.coverShadow, { borderRadius: rounded }]}>
      <View style={[styles.cover, { width: size, height: size, borderRadius: rounded, backgroundColor: story.color }]}>
        {story.cover ? (
          <Image source={{ uri: resolveUrl(story.cover) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <Text style={{ fontSize: size * 0.45 }} allowFontScaling={false}>
            {story.emoji}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  coverShadow: { backgroundColor: colors.card, ...cardShadow },
  cover: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  row: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: fonts.rounded, fontSize: 17, fontWeight: '800', color: colors.text },
  time: { color: colors.muted, fontSize: 13, fontVariant: ['tabular-nums'] },
});
