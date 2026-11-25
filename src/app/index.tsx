import { router, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddProfileCard } from '../components/AddProfileCard';
import { BedtimeEntry } from '../components/BedtimeEntry';
import { SkeletonCard } from '../components/SkeletonCard';
import { StoryCard, type DownloadState } from '../components/StoryCard';
import { StoryRow } from '../components/StoryRow';
import { useDownloads } from '../lib/DownloadsProvider';
import { formatBytes } from '../lib/downloads';
import { useLibrary } from '../lib/LibraryProvider';
import { usePlayer } from '../lib/PlayerProvider';
import { useProfiles } from '../lib/ProfilesProvider';
import { useQueue } from '../lib/QueueProvider';
import { buildHomeSections } from '../lib/recommend';
import { showStoryActions, type DownloadAction } from '../lib/storyActions';
import { colors, fonts, MAX_CONTENT_WIDTH, radius } from '../theme';
import type { Story } from '../types';

const GUTTER = 16;
const MIN_CARD_WIDTH = 170;
/** Row cards show this many cards at once on a phone, so the next one peeks in and hints at scrolling. */
const ROW_VISIBLE_CARDS = 2.3;
const ADD_PROFILE_ROUTE = '/profiles/edit' as Href;

type Filter = 'all' | 'favorites' | 'downloaded';

/**
 * Keeps the playing story's id in a ref without re-rendering the grid: the player context changes
 * on every position tick, so only this null-rendering child subscribes to it.
 */
function CurrentStoryBridge({ currentIdRef }: { currentIdRef: RefObject<string | null> }) {
  const currentId = usePlayer().current?.id ?? null;
  useEffect(() => {
    currentIdRef.current = currentId;
  }, [currentId, currentIdRef]);
  return null;
}
const EMPTY_TEXT: Record<Filter, string> = {
  all: 'No stories yet.',
  favorites: 'Tap the heart on a story to save it here.',
  downloaded: 'No downloads yet. Press and hold a story, or tap the more button on a card, and choose Download.',
};
type Placeholder = { id: string; placeholder: true };

export default function LibraryScreen() {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const insets = useSafeAreaInsets();
  const { stories, loading, favorites, progress, completed, isFavorite, isCompleted, toggleFavorite } = useLibrary();
  const { enqueue, playNext } = useQueue();
  const { ready: profilesReady, activeProfile } = useProfiles();
  const downloads = useDownloads();
  // Read only when the action sheet opens; see CurrentStoryBridge.
  const currentIdRef = useRef<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  // Adaptive grid: 2 columns on iPhone portrait, up to 5 on a landscape iPad.
  const sidePad = Math.max(insets.left, insets.right, GUTTER);
  const contentWidth = Math.min(width, MAX_CONTENT_WIDTH) - sidePad * 2;
  const columns = Math.max(2, Math.floor((contentWidth + GUTTER) / (MIN_CARD_WIDTH + GUTTER)));
  const cardWidth = (contentWidth - GUTTER * (columns - 1)) / columns;

  const rowCardWidth = Math.min(cardWidth, (contentWidth - GUTTER * 2) / ROW_VISIBLE_CARDS);

  const sections = useMemo(
    () => (activeProfile ? buildHomeSections({ stories, profile: activeProfile, progress, completed }) : null),
    [stories, activeProfile, progress, completed],
  );

  // Only catalog stories count: files whose story left the catalog are never listed or summed.
  const downloadedStories = useMemo(
    () => stories.filter((s) => downloads.downloaded[s.id]),
    [stories, downloads.downloaded],
  );
  const downloadedBytes = useMemo(
    () => downloadedStories.reduce((sum, s) => sum + (downloads.downloaded[s.id]?.sizeBytes ?? 0), 0),
    [downloadedStories, downloads.downloaded],
  );

  const data = useMemo(() => {
    if (filter === 'favorites') return stories.filter((s) => favorites.includes(s.id));
    return filter === 'downloaded' ? downloadedStories : stories;
  }, [filter, stories, favorites, downloadedStories]);

  // Two rows of placeholders keep the layout steady while stories load.
  const placeholders = useMemo<Placeholder[]>(
    () => Array.from({ length: columns * 2 }, (_, i) => ({ id: `placeholder-${i}`, placeholder: true })),
    [columns],
  );

  const rows: (Story | Placeholder)[] = loading ? placeholders : data;

  const downloadStateOf = (story: Story): DownloadState | undefined => {
    const fraction = downloads.progress[story.id];
    if (fraction != null) return { downloading: fraction };
    if (downloads.downloaded[story.id]) return 'downloaded';
    return downloads.errors[story.id] ? 'failed' : undefined;
  };

  // The playing story's file cannot be removed, so a downloaded current story gets no entry.
  // A failed download is offered as Download again.
  const downloadActionOf = (story: Story): DownloadAction | undefined => {
    if (downloads.progress[story.id] != null) {
      return { label: 'Cancel download', onPress: () => downloads.cancel(story.id) };
    }
    if (!downloads.downloaded[story.id]) return { label: 'Download', onPress: () => downloads.download(story) };
    if (currentIdRef.current === story.id) return undefined;
    return { label: 'Remove download', onPress: () => downloads.requestRemove(story) };
  };

  const showActions = (story: Story) =>
    showStoryActions(story, {
      onPlayNext: () => playNext(story),
      onAddToQueue: () => enqueue(story),
      download: downloadActionOf(story),
    });

  const renderCard = (story: Story, width: number) => (
    <StoryCard
      story={story}
      width={width}
      favorite={isFavorite(story.id)}
      completed={isCompleted(story.id)}
      landscape={landscape}
      onPress={() => router.push({ pathname: '/story/[id]', params: { id: story.id } })}
      onToggleFavorite={() => toggleFavorite(story.id)}
      onLongPress={() => showActions(story)}
      onPlayNext={() => playNext(story)}
      onAddToQueue={() => enqueue(story)}
      downloadState={downloadStateOf(story)}
    />
  );

  const showSections = sections !== null && filter === 'all' && !loading;
  const header = (
    <View>
      {profilesReady && !activeProfile ? <AddProfileCard onPress={() => router.push(ADD_PROFILE_ROUTE)} /> : null}
      {showSections ? (
        // Rows bleed to the list's edges so their cards scroll under the gutter instead of clipping at it.
        <View style={{ marginHorizontal: -sidePad }}>
          {sections.continueListening.length > 0 ? (
            <StoryRow
              title="Continue listening"
              stories={sections.continueListening}
              sidePad={sidePad}
              renderCard={(story) => renderCard(story, rowCardWidth)}
            />
          ) : null}
          {sections.picked.length > 0 ? (
            <StoryRow
              title={`Picked for ${activeProfile?.name ?? ''}`}
              stories={sections.picked}
              sidePad={sidePad}
              renderCard={(story) => renderCard(story, rowCardWidth)}
            />
          ) : null}
          {sections.genres.map((group) => (
            <StoryRow
              key={group.genre}
              title={group.genre}
              stories={group.stories}
              sidePad={sidePad}
              renderCard={(story) => renderCard(story, rowCardWidth)}
            />
          ))}
          <Text accessibilityRole="header" style={[styles.sectionHeading, { paddingHorizontal: sidePad }]}>
            All stories
          </Text>
        </View>
      ) : null}
      {filter === 'downloaded' && !loading && downloadedStories.length > 0 ? (
        <Text style={styles.summary}>
          {`${downloadedStories.length} ${downloadedStories.length === 1 ? 'story' : 'stories'} · ${formatBytes(downloadedBytes, { trimZero: true })}`}
        </Text>
      ) : null}
    </View>
  );

  const chipLabel = (f: Filter) => {
    if (f === 'all') return 'All stories';
    if (f === 'favorites') return `♥ Favorites${favorites.length ? ` (${favorites.length})` : ''}`;
    return `Downloaded${downloadedStories.length ? ` (${downloadedStories.length})` : ''}`;
  };

  return (
    <View style={styles.screen}>
      <CurrentStoryBridge currentIdRef={currentIdRef} />
      <View style={[styles.filters, { paddingHorizontal: sidePad }]}>
        {(['all', 'favorites', 'downloaded'] as const).map((f) => (
          <Pressable
            key={f}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === f }}
            onPress={() => setFilter(f)}
            style={[styles.chip, filter === f && styles.chipActive]}
          >
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
              {chipLabel(f)}
            </Text>
          </Pressable>
        ))}
        <BedtimeEntry />
      </View>
      <FlatList
        key={columns} // numColumns can't change on a mounted list
        data={rows}
        scrollEnabled={!loading}
        numColumns={columns}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{
          paddingHorizontal: sidePad,
          paddingBottom: 24,
          alignSelf: 'center',
          width: Math.min(width, MAX_CONTENT_WIDTH),
        }}
        columnWrapperStyle={columns > 1 ? { gap: GUTTER, marginBottom: GUTTER } : undefined}
        renderItem={({ item }) =>
          'placeholder' in item ? (
            <SkeletonCard
              width={cardWidth}
              landscape={landscape}
              label={item.id === 'placeholder-0' ? 'Loading stories' : undefined}
            />
          ) : (
            renderCard(item, cardWidth)
          )
        }
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {EMPTY_TEXT[filter]}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 12 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontFamily: fonts.rounded, fontWeight: '700' },
  chipTextActive: { color: colors.primaryText },
  sectionHeading: {
    color: colors.text,
    fontFamily: fonts.rounded,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
  },
  summary: { color: colors.muted, fontFamily: fonts.rounded, fontSize: 14, marginBottom: 12 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 48, fontSize: 16 },
});
