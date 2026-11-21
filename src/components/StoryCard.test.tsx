import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { makeStory } from '../test/fixtures';
import { StoryCard } from './StoryCard';

async function renderCard(props: Partial<React.ComponentProps<typeof StoryCard>> = {}) {
  const onPress = jest.fn();
  const onToggleFavorite = jest.fn();
  const utils = await render(
    <StoryCard
      story={makeStory()}
      width={200}
      favorite={false}
      completed={false}
      onPress={onPress}
      onToggleFavorite={onToggleFavorite}
      {...props}
    />,
  );
  return { onPress, onToggleFavorite, ...utils };
}

describe('StoryCard', () => {
  it('shows the title, duration and age range', async () => {
    await renderCard();

    expect(screen.getByText('The Sleepy Moon')).toBeOnTheScreen();
    expect(screen.getByText('5 min · Ages 3-6')).toBeOnTheScreen();
  });

  it('limits the title to two lines and reserves room for both so card heights match', async () => {
    await renderCard({ story: makeStory({ title: 'Short' }) });

    const title = screen.getByText('Short');
    expect(title.props.numberOfLines).toBe(2);
    expect(StyleSheet.flatten(title.props.style).minHeight).toBeGreaterThanOrEqual(2 * 21);
  });

  it('exposes an accessible label with title and duration', async () => {
    await renderCard();

    expect(screen.getByRole('button', { name: 'The Sleepy Moon, 5 min' })).toBeOnTheScreen();
  });

  it('falls back to the emoji when there is no cover', async () => {
    await renderCard();

    expect(screen.getByText('🌙')).toBeOnTheScreen();
  });

  it('uses a shorter cover in landscape so the title stays on screen', async () => {
    const { unmount } = await renderCard();
    const portraitHeight = StyleSheet.flatten(screen.getByText('🌙').parent?.props.style).height;
    await unmount();

    await renderCard({ landscape: true });
    const landscapeHeight = StyleSheet.flatten(screen.getByText('🌙').parent?.props.style).height;

    expect(landscapeHeight).toBeLessThan(portraitHeight);
  });

  it('shows the cover image instead of the emoji when provided', async () => {
    await renderCard({ story: makeStory({ cover: 'https://cdn.example.com/moon.png' }) });

    expect(screen.queryByText('🌙')).not.toBeOnTheScreen();
  });

  it('shows the Listened badge only when completed', async () => {
    const { rerender } = await renderCard();
    expect(screen.queryByText('✓ Listened')).not.toBeOnTheScreen();

    await rerender(
      <StoryCard
        story={makeStory()}
        width={200}
        favorite={false}
        completed
        onPress={jest.fn()}
        onToggleFavorite={jest.fn()}
      />,
    );
    expect(screen.getByText('✓ Listened')).toBeOnTheScreen();
  });

  it('calls onPress when the card is tapped', async () => {
    const { onPress } = await renderCard();

    await fireEvent.press(screen.getByRole('button', { name: /The Sleepy Moon/ }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('labels the heart button according to the favorite state', async () => {
    const { rerender } = await renderCard();
    expect(screen.getByRole('button', { name: 'Add to favorites' })).toBeOnTheScreen();

    await rerender(
      <StoryCard
        story={makeStory()}
        width={200}
        favorite
        completed={false}
        onPress={jest.fn()}
        onToggleFavorite={jest.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Remove from favorites' })).toBeOnTheScreen();
  });

  it('calls onToggleFavorite without triggering onPress', async () => {
    const { onPress, onToggleFavorite } = await renderCard();

    await fireEvent.press(screen.getByRole('button', { name: 'Add to favorites' }));

    expect(onToggleFavorite).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });
});
