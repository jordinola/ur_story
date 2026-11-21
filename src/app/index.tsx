import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SkeletonCard } from '../components/SkeletonCard';
import { StoryCard } from '../components/StoryCard';
import { useLibrary } from '../lib/LibraryProvider';
import { colors, fonts, MAX_CONTENT_WIDTH, radius } from '../theme';
import type { Story } from '../types';

const GUTTER = 16;
const MIN_CARD_WIDTH = 170;

type Filter = 'all' | 'favorites';
type Placeholder = { id: string; placeholder: true };

export default function LibraryScreen() {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const insets = useSafeAreaInsets();
  const { stories, loading, favorites, isFavorite, isCompleted, toggleFavorite } = useLibrary();
  const [filter, setFilter] = useState<Filter>('all');

  // Adaptive grid: 2 columns on iPhone portrait, up to 5 on a landscape iPad.
  const sidePad = Math.max(insets.left, insets.right, GUTTER);
  const contentWidth = Math.min(width, MAX_CONTENT_WIDTH) - sidePad * 2;
  const columns = Math.max(2, Math.floor((contentWidth + GUTTER) / (MIN_CARD_WIDTH + GUTTER)));
  const cardWidth = (contentWidth - GUTTER * (columns - 1)) / columns;

  const data = useMemo(
    () => (filter === 'favorites' ? stories.filter((s) => favorites.includes(s.id)) : stories),
    [filter, stories, favorites],
  );

  // Two rows of placeholders keep the layout steady while stories load.
  const placeholders = useMemo<Placeholder[]>(
    () => Array.from({ length: columns * 2 }, (_, i) => ({ id: `placeholder-${i}`, placeholder: true })),
    [columns],
  );

  const rows: (Story | Placeholder)[] = loading ? placeholders : data;

  return (
    <View style={styles.screen}>
      <View style={[styles.filters, { paddingHorizontal: sidePad }]}>
        {(['all', 'favorites'] as const).map((f) => (
          <Pressable
            key={f}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === f }}
            onPress={() => setFilter(f)}
            style={[styles.chip, filter === f && styles.chipActive]}
          >
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
              {f === 'all' ? 'All stories' : `♥ Favorites${favorites.length ? ` (${favorites.length})` : ''}`}
            </Text>
          </Pressable>
        ))}
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
            <StoryCard
              story={item}
              width={cardWidth}
              favorite={isFavorite(item.id)}
              completed={isCompleted(item.id)}
              landscape={landscape}
              onPress={() => router.push({ pathname: '/story/[id]', params: { id: item.id } })}
              onToggleFavorite={() => toggleFavorite(item.id)}
            />
          )
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {filter === 'favorites' ? 'Tap the heart on a story to save it here.' : 'No stories yet.'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  filters: { flexDirection: 'row', gap: 8, paddingVertical: 12 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontFamily: fonts.rounded, fontWeight: '700' },
  chipTextActive: { color: colors.primaryText },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 48, fontSize: 16 },
});
