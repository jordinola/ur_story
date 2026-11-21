import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import * as RN from 'react-native';
import LibraryScreen from '../app/index';
import { makeStory } from '../test/fixtures';
import type { Story } from '../types';

const stories = [
  makeStory({ id: 'a', title: 'Story A' }),
  makeStory({ id: 'b', title: 'Story B' }),
  makeStory({ id: 'c', title: 'Story C' }),
];

const mockLibrary: {
  stories: Story[];
  loading: boolean;
  favorites: string[];
  isFavorite: jest.Mock;
  isCompleted: jest.Mock;
  toggleFavorite: jest.Mock;
} = {
  stories,
  loading: false,
  favorites: [],
  isFavorite: jest.fn((id: string): boolean => mockLibrary.favorites.includes(id)),
  isCompleted: jest.fn((id: string) => id === 'c'),
  toggleFavorite: jest.fn(),
};

jest.mock('../lib/LibraryProvider', () => ({ useLibrary: () => mockLibrary }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

function setWidth(width: number) {
  jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width, height: 800, scale: 2, fontScale: 1 });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLibrary.stories = stories;
  mockLibrary.loading = false;
  mockLibrary.favorites = [];
  setWidth(390);
});

describe('LibraryScreen', () => {
  it('lists all stories by default', async () => {
    await render(<LibraryScreen />);

    for (const title of ['Story A', 'Story B', 'Story C']) {
      expect(screen.getByText(title)).toBeOnTheScreen();
    }
  });

  it('shows the Listened badge on completed stories', async () => {
    await render(<LibraryScreen />);

    expect(screen.getAllByText('✓ Listened')).toHaveLength(1);
  });

  it('opens a story when its card is tapped', async () => {
    await render(<LibraryScreen />);

    await fireEvent.press(screen.getByRole('button', { name: /Story B/ }));

    expect(router.push).toHaveBeenCalledWith({ pathname: '/story/[id]', params: { id: 'b' } });
  });

  it('toggles a favorite from the card heart', async () => {
    await render(<LibraryScreen />);

    await fireEvent.press(screen.getAllByRole('button', { name: 'Add to favorites' })[0]);

    expect(mockLibrary.toggleFavorite).toHaveBeenCalledWith('a');
  });

  describe('filters', () => {
    it('marks "All stories" as selected initially', async () => {
      await render(<LibraryScreen />);

      expect(screen.getByRole('button', { name: 'All stories', selected: true })).toBeOnTheScreen();
    });

    it('shows only favorites when the Favorites filter is selected', async () => {
      mockLibrary.favorites = ['b'];
      await render(<LibraryScreen />);

      await fireEvent.press(screen.getByText('♥ Favorites (1)'));

      expect(screen.getByText('Story B')).toBeOnTheScreen();
      expect(screen.queryByText('Story A')).not.toBeOnTheScreen();
      expect(screen.queryByText('Story C')).not.toBeOnTheScreen();
    });

    it('omits the count when there are no favorites', async () => {
      await render(<LibraryScreen />);

      expect(screen.getByText('♥ Favorites')).toBeOnTheScreen();
    });

    it('returns to all stories when "All stories" is selected again', async () => {
      mockLibrary.favorites = ['b'];
      await render(<LibraryScreen />);
      await fireEvent.press(screen.getByText('♥ Favorites (1)'));

      await fireEvent.press(screen.getByText('All stories'));

      expect(screen.getByText('Story A')).toBeOnTheScreen();
    });
  });

  describe('empty states', () => {
    it('explains how to add favorites when there are none', async () => {
      await render(<LibraryScreen />);

      await fireEvent.press(screen.getByText('♥ Favorites'));

      expect(screen.getByText('Tap the heart on a story to save it here.')).toBeOnTheScreen();
    });

    it('says there are no stories when the catalog is empty', async () => {
      mockLibrary.stories = [];
      await render(<LibraryScreen />);

      expect(screen.getByText('No stories yet.')).toBeOnTheScreen();
    });
  });

  describe('loading', () => {
    it('shows placeholder cards instead of stories while loading', async () => {
      mockLibrary.loading = true;
      mockLibrary.stories = [];
      await render(<LibraryScreen />);

      expect(screen.getByRole('progressbar', { name: 'Loading stories' })).toBeOnTheScreen();
      expect(screen.queryByText('No stories yet.')).not.toBeOnTheScreen();
    });

    it('replaces the placeholders with stories once loaded', async () => {
      mockLibrary.loading = true;
      mockLibrary.stories = [];
      const { rerender } = await render(<LibraryScreen />);

      mockLibrary.loading = false;
      mockLibrary.stories = stories;
      await rerender(<LibraryScreen />);

      expect(screen.queryByRole('progressbar')).not.toBeOnTheScreen();
      expect(screen.getByText('Story A')).toBeOnTheScreen();
    });
  });

  describe('adaptive layout', () => {
    it('renders on an iPad-width window', async () => {
      setWidth(1180);
      await render(<LibraryScreen />);

      expect(screen.getByText('Story A')).toBeOnTheScreen();
    });
  });
});
