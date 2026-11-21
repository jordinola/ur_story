import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayerControls } from '../../components/PlayerControls';
import { resolveUrl } from '../../lib/catalog';
import { formatMinutes } from '../../lib/format';
import { useLibrary } from '../../lib/LibraryProvider';
import { usePlayer } from '../../lib/PlayerProvider';
import { cardShadow, colors, fonts, MAX_CONTENT_WIDTH, radius } from '../../theme';

export default function StoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getStory, isFavorite, toggleFavorite, ready, stories } = useLibrary();
  const player = usePlayer();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const story = getStory(id);

  // Start playing when the screen opens for a story that isn't already loaded.
  useEffect(() => {
    if (story && player.current?.id !== story.id) player.play(story);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  if (!story) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{ready && stories.length > 0 ? 'Story not found.' : 'Loading…'}</Text>
      </View>
    );
  }

  // Two panes on iPad and on iPhone in landscape; stacked on iPhone portrait.
  const isWide = width >= 700;
  const sidePad = Math.max(insets.left, insets.right, 20);
  const contentWidth = Math.min(width, MAX_CONTENT_WIDTH) - sidePad * 2;
  const coverSize = isWide
    ? Math.min(contentWidth * 0.42, height - 140, 460)
    : Math.min(contentWidth, 420);
  const fav = isFavorite(story.id);

  // Shadow sits on the outer view because iOS drops shadows on views that clip their content.
  const cover = (
    <View style={styles.coverShadow}>
      <View style={[styles.cover, { width: coverSize, height: coverSize, backgroundColor: story.color }]}>
        {story.cover ? (
          <Image source={{ uri: resolveUrl(story.cover) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <Text style={{ fontSize: coverSize * 0.45 }}>{story.emoji}</Text>
        )}
      </View>
    </View>
  );

  const details = (
    <View style={[styles.details, isWide && { flex: 1 }]}>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{story.title}</Text>
          <Text style={styles.meta}>
            {formatMinutes(story.durationSec)} · Ages {story.ageRange}
          </Text>
        </View>
        <Pressable
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={fav ? 'Remove from favorites' : 'Add to favorites'}
          onPress={() => toggleFavorite(story.id)}
        >
          <Text style={[styles.heart, { color: fav ? colors.heart : colors.muted }]}>{fav ? '♥' : '♡'}</Text>
        </Pressable>
      </View>
      <Text style={styles.description}>{story.description}</Text>
      <PlayerControls />
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: '' }} />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingHorizontal: sidePad, paddingBottom: Math.max(insets.bottom, 24) },
          isWide ? styles.rowLayout : styles.columnLayout,
        ]}
      >
        {cover}
        {details}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: colors.muted, fontSize: 16 },
  scroll: { flexGrow: 1, paddingTop: 8, alignSelf: 'center', width: '100%', maxWidth: MAX_CONTENT_WIDTH },
  columnLayout: { alignItems: 'center', gap: 24 },
  rowLayout: { flexDirection: 'row', alignItems: 'center', gap: 36 },
  cover: { borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  coverShadow: { borderRadius: radius.xl, backgroundColor: colors.card, ...cardShadow },
  details: { width: '100%', gap: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { fontFamily: fonts.rounded, fontSize: 26, fontWeight: '800', color: colors.text },
  meta: { color: colors.muted, fontSize: 14, marginTop: 4 },
  heart: { fontSize: 30 },
  description: { fontSize: 16, lineHeight: 23, color: colors.text },
});
