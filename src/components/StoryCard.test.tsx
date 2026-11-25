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

  it('StoryCard shows the Downloaded badge', async () => {
    const { rerender } = await renderCard();
    expect(screen.queryByText('Downloaded')).not.toBeOnTheScreen();

    await rerender(
      <StoryCard
        story={makeStory()}
        width={200}
        favorite={false}
        completed
        downloadState="downloaded"
        onPress={jest.fn()}
        onToggleFavorite={jest.fn()}
      />,
    );
    // Both badges show, stacked in one column so they never overlap.
    const downloaded = screen.getByText('Downloaded');
    const listened = screen.getByText('✓ Listened');
    expect(downloaded.parent?.parent).toBe(listened.parent?.parent);
    expect(StyleSheet.flatten(downloaded.parent?.parent?.props.style).position).toBe('absolute');
    expect(StyleSheet.flatten(downloaded.parent?.props.style).position).toBeUndefined();
  });

  it('StoryCard shows the download percentage', async () => {
    const { rerender } = await renderCard({ downloadState: { downloading: 0.404 } });
    expect(screen.getByText('Downloading 40%')).toBeOnTheScreen();

    await rerender(
      <StoryCard
        story={makeStory()}
        width={200}
        favorite={false}
        completed={false}
        downloadState={{ downloading: 0 }}
        onPress={jest.fn()}
        onToggleFavorite={jest.fn()}
      />,
    );
    expect(screen.getByText('Downloading 0%')).toBeOnTheScreen();
  });

  it('StoryCard label mentions the state', async () => {
    const { rerender } = await renderCard({ downloadState: 'downloaded' });
    expect(screen.getByRole('button', { name: 'The Sleepy Moon, 5 min, downloaded' })).toBeOnTheScreen();

    await rerender(
      <StoryCard
        story={makeStory()}
        width={200}
        favorite={false}
        completed={false}
        downloadState={{ downloading: 0.4 }}
        onPress={jest.fn()}
        onToggleFavorite={jest.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'The Sleepy Moon, 5 min, downloading 40 percent' })).toBeOnTheScreen();
  });

  it('StoryCard shows a Download failed badge stacked with Listened', async () => {
    await renderCard({ downloadState: 'failed', completed: true });

    const failed = screen.getByText('Download failed');
    const listened = screen.getByText('✓ Listened');
    expect(failed.parent?.parent).toBe(listened.parent?.parent);
  });

  it('StoryCard label mentions a failed download', async () => {
    await renderCard({ downloadState: 'failed' });

    expect(screen.getByRole('button', { name: 'The Sleepy Moon, 5 min, download failed' })).toBeOnTheScreen();
  });

  it('calls onPress when the card is tapped', async () => {
    const { onPress } = await renderCard();

    await fireEvent.press(screen.getByRole('button', { name: /^The Sleepy Moon,/ }));

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

  it('calls onLongPress when the card is long-pressed', async () => {
    const onLongPress = jest.fn();
    await renderCard({ onLongPress });

    await fireEvent(screen.getByRole('button', { name: /^The Sleepy Moon,/ }), 'longPress');

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('exposes Play next and Add to queue as accessibility actions', async () => {
    const onPlayNext = jest.fn();
    const onAddToQueue = jest.fn();
    await renderCard({ onPlayNext, onAddToQueue });
    const card = screen.getByRole('button', { name: /^The Sleepy Moon,/ });

    expect(card.props.accessibilityActions).toEqual([
      { name: 'playNext', label: 'Play next' },
      { name: 'addToQueue', label: 'Add to queue' },
    ]);
    await fireEvent(card, 'accessibilityAction', { nativeEvent: { actionName: 'playNext' } });
    await fireEvent(card, 'accessibilityAction', { nativeEvent: { actionName: 'addToQueue' } });
    expect(onPlayNext).toHaveBeenCalledTimes(1);
    expect(onAddToQueue).toHaveBeenCalledTimes(1);
  });

  describe('more actions button', () => {
    it('renders with the story title in its label when onLongPress is provided', async () => {
      await renderCard({ onLongPress: jest.fn() });

      expect(screen.getByRole('button', { name: 'More actions for The Sleepy Moon' })).toBeOnTheScreen();
    });

    it('calls onLongPress once without triggering the card press', async () => {
      const onLongPress = jest.fn();
      const { onPress } = await renderCard({ onLongPress });

      await fireEvent.press(screen.getByRole('button', { name: 'More actions for The Sleepy Moon' }));

      expect(onLongPress).toHaveBeenCalledTimes(1);
      expect(onPress).not.toHaveBeenCalled();
    });

    it('is absent when onLongPress is not provided', async () => {
      await renderCard();

      expect(screen.queryByRole('button', { name: /More actions/ })).not.toBeOnTheScreen();
    });

    it('leaves the favorite button working alongside it', async () => {
      const { onToggleFavorite } = await renderCard({ onLongPress: jest.fn() });

      await fireEvent.press(screen.getByRole('button', { name: 'Add to favorites' }));

      expect(onToggleFavorite).toHaveBeenCalledTimes(1);
    });

    it('has a touch target of at least 44pt', async () => {
      await renderCard({ onLongPress: jest.fn() });
      const button = screen.getByRole('button', { name: 'More actions for The Sleepy Moon' });
      const { width, height } = StyleSheet.flatten(button.props.style);
      const slop = button.props.hitSlop;

      expect(width + (slop?.left ?? 0) + (slop?.right ?? 0)).toBeGreaterThanOrEqual(44);
      expect(height + (slop?.top ?? 0) + (slop?.bottom ?? 0)).toBeGreaterThanOrEqual(44);
    });
  });
});
