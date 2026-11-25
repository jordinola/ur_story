import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MoreSheet } from '../../components/MoreSheet';
import { NowPlayingCover } from '../../components/NowPlayingCover';
import { PlayerBottomBar } from '../../components/PlayerBottomBar';
import { QueuePanel } from '../../components/QueuePanel';
import { TransportControls } from '../../components/TransportControls';
import { UpNextBanner } from '../../components/UpNextBanner';
import { formatMinutes } from '../../lib/format';
import { useLayoutToggle } from '../../lib/useLayoutToggle';
import { useLibrary } from '../../lib/LibraryProvider';
import { usePlayer } from '../../lib/PlayerProvider';
import { colors, fonts, MAX_CONTENT_WIDTH } from '../../theme';

export default function StoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getStory, isFavorite, toggleFavorite, ready, stories } = useLibrary();
  const player = usePlayer();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [queueOpen, toggleQueue] = useLayoutToggle();
  const [moreOpen, setMoreOpen] = useState(false);
  const openMore = useCallback(() => setMoreOpen(true), []);
  const closeMore = useCallback(() => setMoreOpen(false), []);

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

  // Two panes on iPad and in any landscape orientation (a landscape SE is only 375pt tall); stacked on narrow portrait.
  const isWide = width >= 700 || width > height;
  const sidePad = Math.max(insets.left, insets.right, 20);
  const contentWidth = Math.min(width, MAX_CONTENT_WIDTH) - sidePad * 2;
  const coverSize = isWide
    ? Math.min(contentWidth * 0.42, height - 140, 460)
    : Math.min(contentWidth, 420);
  // The queue list scrolls, so its pane is not limited by the screen height like the square cover.
  const queuePaneWidth = Math.min(contentWidth * 0.42, 460);
  const fav = isFavorite(story.id);

  const cover = <NowPlayingCover story={story} size={coverSize} compact={queueOpen} onToggle={toggleQueue} />;

  const titleRow = (
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
  );

  const description = <Text style={styles.description}>{story.description}</Text>;

  let body: ReactNode;
  if (isWide) {
    body = (
      <>
        <View style={queueOpen ? [styles.leftPane, { width: queuePaneWidth }] : undefined}>
          {cover}
          {queueOpen ? <QueuePanel /> : null}
        </View>
        <View style={[styles.details, { flex: 1 }]}>
          {titleRow}
          <UpNextBanner />
          <TransportControls />
          {description}
        </View>
      </>
    );
  } else if (queueOpen) {
    body = (
      <View style={styles.details}>
        {cover}
        <QueuePanel />
      </View>
    );
  } else {
    body = (
      <>
        {cover}
        <View style={styles.details}>
          {titleRow}
          {description}
        </View>
      </>
    );
  }

  // On narrow screens the transport sits outside the scroll area so it never scrolls away.
  const footer = isWide ? null : (
    // Capped at half the window so large Dynamic Type scrolls the footer instead of pushing the bottom bar off screen.
    <View testID="story-footer" style={[styles.footer, { maxHeight: height * 0.5 }]}>
      <ScrollView
        bounces={false}
        contentContainerStyle={[styles.footerContent, { paddingHorizontal: sidePad }]}
      >
        <UpNextBanner />
        <TransportControls />
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: '' }} />
      <ScrollView
        testID="story-scroll"
        style={styles.screen}
        contentContainerStyle={[
          styles.scroll,
          // The footer and bottom bar below the scroll area already clear the home indicator.
          { paddingHorizontal: sidePad, paddingBottom: isWide ? 24 : 16 },
          isWide ? styles.rowLayout : styles.columnLayout,
          isWide && queueOpen && styles.rowLayoutTop,
        ]}
      >
        {body}
      </ScrollView>
      {footer}
      <PlayerBottomBar queueOpen={queueOpen} onToggleQueue={toggleQueue} onOpenMore={openMore} />
      <MoreSheet visible={moreOpen} onClose={closeMore} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: colors.muted, fontSize: 16 },
  scroll: { flexGrow: 1, paddingTop: 8, alignSelf: 'center', width: '100%', maxWidth: MAX_CONTENT_WIDTH },
  columnLayout: { alignItems: 'center', gap: 24 },
  rowLayout: { flexDirection: 'row', alignItems: 'center', gap: 36 },
  rowLayoutTop: { alignItems: 'flex-start' },
  leftPane: { gap: 16 },
  details: { width: '100%', gap: 16 },
  footer: {
    flexShrink: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    backgroundColor: colors.bg,
  },
  footerContent: { gap: 12, paddingTop: 8, paddingBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { fontFamily: fonts.rounded, fontSize: 26, fontWeight: '800', color: colors.text },
  meta: { color: colors.muted, fontSize: 14, marginTop: 4 },
  heart: { fontSize: 30 },
  description: { fontSize: 16, lineHeight: 23, color: colors.text },
});
