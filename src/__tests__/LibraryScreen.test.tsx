import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import * as RN from 'react-native';
import LibraryScreen from '../app/index';
import { makeStory } from '../test/fixtures';
import type { Profile, Story } from '../types';

const stories = [
  makeStory({ id: 'a', title: 'Story A' }),
  makeStory({ id: 'b', title: 'Story B' }),
  makeStory({ id: 'c', title: 'Story C' }),
];

const mockLibrary: {
  stories: Story[];
  loading: boolean;
  favorites: string[];
  progress: Record<string, number>;
  completed: string[];
  isFavorite: jest.Mock;
  isCompleted: jest.Mock;
  toggleFavorite: jest.Mock;
} = {
  stories,
  loading: false,
  favorites: [],
  progress: {},
  completed: [],
  isFavorite: jest.fn((id: string): boolean => mockLibrary.favorites.includes(id)),
  isCompleted: jest.fn((id: string) => id === 'c'),
  toggleFavorite: jest.fn(),
};

const mockProfiles: { ready: boolean; activeProfile: Profile | null } = { ready: true, activeProfile: null };

jest.mock('../lib/LibraryProvider', () => ({ useLibrary: () => mockLibrary }));
jest.mock('../lib/ProfilesProvider', () => ({ useProfiles: () => mockProfiles }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../lib/BedtimeProvider', () => ({
  useBedtime: () => ({ active: false, remainingSec: null, startBedtime: jest.fn(), endBedtime: jest.fn() }),
}));

function setWidth(width: number) {
  jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width, height: 800, scale: 2, fontScale: 1 });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLibrary.stories = stories;
  mockLibrary.loading = false;
  mockLibrary.favorites = [];
  mockLibrary.progress = {};
  mockLibrary.completed = [];
  mockProfiles.ready = true;
  mockProfiles.activeProfile = null;
  setWidth(390);
});

const mia: Profile = { id: 'p1', name: 'Mia', age: 5, tags: ['animals'], languages: ['en'], color: '#1D4ED8' };

describe('LibraryScreen', () => {
  it('shows the Bedtime chip', async () => {
    await render(<LibraryScreen />);

    expect(screen.getByRole('button', { name: 'Bedtime' })).toBeOnTheScreen();
  });

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

  describe('add profile card', () => {
    it('invites adding a profile when none is active and opens the gated route', async () => {
      await render(<LibraryScreen />);

      await fireEvent.press(screen.getByRole('button', { name: 'Add a kid profile' }));

      expect(router.push).toHaveBeenCalledWith('/profiles/edit');
    });

    it('is hidden once a profile is active', async () => {
      mockProfiles.activeProfile = mia;
      await render(<LibraryScreen />);

      expect(screen.queryByRole('button', { name: 'Add a kid profile' })).not.toBeOnTheScreen();
    });
  });

  describe('with an active profile', () => {
    const sectioned = [
      makeStory({ id: 'a', title: 'Story A', genres: ['Animals'], tags: ['animals'] }),
      makeStory({ id: 'b', title: 'Story B', genres: ['Space'] }),
      makeStory({ id: 'c', title: 'Story C', genres: ['Animals'] }),
    ];

    beforeEach(() => {
      mockProfiles.activeProfile = mia;
      mockLibrary.stories = sectioned;
    });

    const headings = () => screen.getAllByRole('header').map((h) => h.props.children);

    it('orders the sections: continue, picked, genres, then all stories', async () => {
      mockLibrary.progress = { b: 30 };
      await render(<LibraryScreen />);

      expect(headings()).toEqual(['Continue listening', 'Picked for Mia', 'Animals', 'Space', 'All stories']);
    });

    it('omits empty sections', async () => {
      mockLibrary.stories = [makeStory({ id: 'z', title: 'Story Z', ageMin: 12, ageMax: 14, language: 'fr' })];
      await render(<LibraryScreen />);

      expect(screen.queryByRole('header', { name: 'Continue listening' })).not.toBeOnTheScreen();
      expect(screen.getByRole('header', { name: 'All stories' })).toBeOnTheScreen();
    });

    it('shows a flat favorites grid with no sections', async () => {
      mockLibrary.favorites = ['b'];
      mockLibrary.progress = { a: 10 };
      await render(<LibraryScreen />);

      await fireEvent.press(screen.getByText('♥ Favorites (1)'));

      expect(screen.queryAllByRole('header')).toHaveLength(0);
      expect(screen.getByText('Story B')).toBeOnTheScreen();
      expect(screen.queryByText('Story A')).not.toBeOnTheScreen();
    });

    it('keeps the favorites empty message', async () => {
      await render(<LibraryScreen />);

      await fireEvent.press(screen.getByText('♥ Favorites'));

      expect(screen.getByText('Tap the heart on a story to save it here.')).toBeOnTheScreen();
    });

    it('opens a story from a row card', async () => {
      mockLibrary.progress = { b: 30 };
      await render(<LibraryScreen />);

      const [firstCard] = screen.getAllByRole('button', { name: /Story B/ });
      await fireEvent.press(firstCard);

      expect(router.push).toHaveBeenCalledWith({ pathname: '/story/[id]', params: { id: 'b' } });
    });

    it('toggles a favorite from a row card heart', async () => {
      mockLibrary.progress = { b: 30 };
      await render(<LibraryScreen />);

      const row = screen.getByTestId('story-row-Continue listening');
      await fireEvent.press(within(row).getByRole('button', { name: 'Add to favorites' }));

      expect(mockLibrary.toggleFavorite).toHaveBeenCalledWith('b');
    });

    it('shows only skeletons while loading', async () => {
      mockLibrary.loading = true;
      mockLibrary.stories = [];
      await render(<LibraryScreen />);

      expect(screen.queryAllByRole('header')).toHaveLength(0);
      expect(screen.getByRole('progressbar', { name: 'Loading stories' })).toBeOnTheScreen();
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
