import type { ReactElement } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import type { Story } from '../types';

const CARD_GAP = 12;

type Props = {
  title: string;
  stories: Story[];
  renderCard: (story: Story) => ReactElement;
  /** Horizontal inset for the heading and the first/last card, so the row lines up with the screen gutter. */
  sidePad?: number;
};

export function StoryRow({ title, stories, renderCard, sidePad = 0 }: Props) {
  return (
    <View style={styles.row}>
      <Text accessibilityRole="header" style={[styles.heading, { paddingHorizontal: sidePad }]}>
        {title}
      </Text>
      <FlatList
        testID={`story-row-${title}`}
        horizontal
        data={stories}
        keyExtractor={(story) => story.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: sidePad, gap: CARD_GAP, paddingBottom: 16 }}
        renderItem={({ item }) => renderCard(item)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: 4 },
  heading: { color: colors.text, fontFamily: fonts.rounded, fontSize: 20, fontWeight: '800', marginBottom: 10 },
});
