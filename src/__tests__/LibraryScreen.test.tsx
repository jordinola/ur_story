import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
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
const mockQueue = { enqueue: jest.fn(), playNext: jest.fn() };
jest.mock('../lib/QueueProvider', () => ({ useQueue: () => mockQueue }));
const mockDownloads = {
  downloaded: {} as Record<string, { sizeBytes: number }>,
  progress: {} as Record<string, number>,
  errors: {} as Record<string, string>,
  download: jest.fn(),
  cancel: jest.fn(),
  requestRemove: jest.fn(),
};
jest.mock('../lib/DownloadsProvider', () => ({ useDownloads: () => mockDownloads }));
// A tiny external store, so a change to the player (for example its position) re-renders only the
// components that actually call usePlayer, as the real context does.
const mockPlayerStore = {
  state: { current: null as Story | null, position: 0 },
  listeners: new Set<() => void>(),
  set(patch: Partial<{ current: Story | null; position: number }>) {
    mockPlayerStore.state = { ...mockPlayerStore.state, ...patch };
    mockPlayerStore.listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) {
    mockPlayerStore.listeners.add(listener);
    return () => mockPlayerStore.listeners.delete(listener);
  },
};
jest.mock('../lib/PlayerProvider', () => {
  const { useSyncExternalStore } = jest.requireActual('react');
  return {
    usePlayer: () => useSyncExternalStore(mockPlayerStore.subscribe, () => mockPlayerStore.state),
  };
});
const mockCardRenders = jest.fn();
jest.mock('../components/StoryCard', () => {
  const actual = jest.requireActual('../components/StoryCard');
  return {
    ...actual,
    StoryCard: (props: { story: Story }) => {
      mockCardRenders(props.story.id);
      return actual.StoryCard(props);
    },
  };
});
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
  mockDownloads.downloaded = {};
  mockDownloads.progress = {};
  mockDownloads.errors = {};
  mockPlayerStore.state = { current: null, position: 0 };
  mockProfiles.ready = true;
  mockProfiles.activeProfile = null;
  setWidth(390);
});

const mia: Profile = { id: 'p1', name: 'Mia', age: 5, tags: ['animals'], languages: ['en'], color: '#1D4ED8' };

describe('LibraryScreen', () => {
  it('long-press then Add to queue adds the story to the queue', async () => {
    jest.spyOn(RN.ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((_options, callback) => callback(1));
    await render(<LibraryScreen />);

    await fireEvent(screen.getByRole('button', { name: /^Story B,/ }), 'longPress');

    expect(mockQueue.enqueue).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));
  });

  it('tapping More actions then Add to queue adds the story to the queue', async () => {
    jest.spyOn(RN.ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((_options, callback) => callback(1));
    await render(<LibraryScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'More actions for Story B' }));

    expect(mockQueue.enqueue).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));
  });

  it('LibraryScreen long-press then Download starts the download', async () => {
    const spy = jest
      .spyOn(RN.ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation((_options, callback) => callback(2));
    await render(<LibraryScreen />);

    await fireEvent(screen.getByRole('button', { name: /^Story B,/ }), 'longPress');

    expect(spy.mock.lastCall?.[0].options).toEqual(['Play next', 'Add to queue', 'Download', 'Cancel']);
    expect(mockDownloads.download).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));
  });

  it('LibraryScreen offers Cancel download while a story is downloading', async () => {
    mockDownloads.progress = { b: 0 };
    jest.spyOn(RN.ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((_options, callback) => callback(2));
    await render(<LibraryScreen />);

    expect(screen.getByText('Downloading 0%')).toBeOnTheScreen();
    await fireEvent(screen.getByRole('button', { name: /^Story B,/ }), 'longPress');

    expect(mockDownloads.cancel).toHaveBeenCalledWith('b');
    expect(mockDownloads.download).not.toHaveBeenCalled();
  });

  it('LibraryScreen Remove download opens the removal request', async () => {
    mockDownloads.downloaded = { b: { sizeBytes: 1000 } };
    jest.spyOn(RN.ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((_options, callback) => callback(2));
    await render(<LibraryScreen />);

    expect(screen.getByRole('button', { name: /^Story B, .*, downloaded$/ })).toBeOnTheScreen();
    await fireEvent(screen.getByRole('button', { name: /^Story B,/ }), 'longPress');

    expect(mockDownloads.requestRemove).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));
  });

  it('LibraryScreen offers no download entry for the playing downloaded story', async () => {
    mockDownloads.downloaded = { b: { sizeBytes: 1000 } };
    mockPlayerStore.state = { current: stories[1] ?? null, position: 0 };
    const spy = jest.spyOn(RN.ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => {});
    await render(<LibraryScreen />);

    await fireEvent(screen.getByRole('button', { name: /^Story B,/ }), 'longPress');

    expect(spy.mock.lastCall?.[0].options).toEqual(['Play next', 'Add to queue', 'Cancel']);
  });

  it('LibraryScreen does not re-render its cards when only the player position changes', async () => {
    mockPlayerStore.state = { current: stories[0] ?? null, position: 0 };
    await render(<LibraryScreen />);
    const rendersBefore = mockCardRenders.mock.calls.length;

    await act(async () => {
      mockPlayerStore.set({ position: 5 });
      mockPlayerStore.set({ position: 6 });
    });

    expect(mockCardRenders.mock.calls.length).toBe(rendersBefore);
  });

  it('LibraryScreen does not offer Remove download once the story starts playing', async () => {
    mockDownloads.downloaded = { b: { sizeBytes: 1000 } };
    const spy = jest.spyOn(RN.ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => {});
    await render(<LibraryScreen />);

    await act(async () => mockPlayerStore.set({ current: stories[1] ?? null }));
    await fireEvent(screen.getByRole('button', { name: /^Story B,/ }), 'longPress');

    expect(spy.mock.lastCall?.[0].options).toEqual(['Play next', 'Add to queue', 'Cancel']);
  });

  it('LibraryScreen shows a failed download on the card and offers Download again', async () => {
    mockDownloads.errors = { b: 'Could not download this story. Check your connection.' };
    const spy = jest
      .spyOn(RN.ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation((_options, callback) => callback(2));
    await render(<LibraryScreen />);

    expect(screen.getByText('Download failed')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^Story B, .*, download failed$/ })).toBeOnTheScreen();
    await fireEvent(screen.getByRole('button', { name: /^Story B,/ }), 'longPress');

    expect(spy.mock.lastCall?.[0].options).toEqual(['Play next', 'Add to queue', 'Download', 'Cancel']);
    expect(mockDownloads.download).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));
  });

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

    await fireEvent.press(screen.getByRole('button', { name: /^Story B,/ }));

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

  describe('Downloaded filter', () => {
    const MB = 1024 * 1024;

    it('the Downloaded chip lists only downloaded stories that are in the catalog', async () => {
      mockDownloads.downloaded = { b: { sizeBytes: MB }, ghost: { sizeBytes: MB } };
      await render(<LibraryScreen />);

      await fireEvent.press(screen.getByText('Downloaded (1)'));

      expect(screen.getByText('Story B')).toBeOnTheScreen();
      expect(screen.queryByText('Story A')).not.toBeOnTheScreen();
      expect(screen.queryByText('Story C')).not.toBeOnTheScreen();
    });

    it('the chip shows the count', async () => {
      mockDownloads.downloaded = { a: { sizeBytes: MB }, c: { sizeBytes: MB } };
      await render(<LibraryScreen />);

      expect(screen.getByRole('button', { name: 'Downloaded (2)', selected: false })).toBeOnTheScreen();
    });

    it('filter chips meet the 44 pt minimum touch target', async () => {
      await render(<LibraryScreen />);

      for (const name of ['All stories', 'Favorites', 'Downloaded']) {
        expect(screen.getByRole('button', { name: new RegExp(name) })).toHaveStyle({ minHeight: 44 });
      }
    });

    it('omits the count when nothing is downloaded', async () => {
      await render(<LibraryScreen />);

      expect(screen.getByRole('button', { name: 'Downloaded' })).toBeOnTheScreen();
    });

    it('the summary line shows count and size', async () => {
      mockDownloads.downloaded = { a: { sizeBytes: 10 * MB }, b: { sizeBytes: 20 * MB }, c: { sizeBytes: 12 * MB } };
      await render(<LibraryScreen />);

      await fireEvent.press(screen.getByText('Downloaded (3)'));

      expect(screen.getByText('3 stories · 42 MB')).toBeOnTheScreen();
    });

    it('orphaned files are not counted', async () => {
      mockDownloads.downloaded = { a: { sizeBytes: 5 * MB }, ghost: { sizeBytes: 500 * MB } };
      await render(<LibraryScreen />);

      await fireEvent.press(screen.getByText('Downloaded (1)'));

      expect(screen.getByText('1 story · 5 MB')).toBeOnTheScreen();
    });

    it('singular wording for one story', async () => {
      mockDownloads.downloaded = { a: { sizeBytes: 842 * 1024 } };
      await render(<LibraryScreen />);

      await fireEvent.press(screen.getByText('Downloaded (1)'));

      expect(screen.getByText('1 story · 842 KB')).toBeOnTheScreen();
    });

    it('the empty state explains how to download', async () => {
      mockDownloads.downloaded = { ghost: { sizeBytes: MB } };
      await render(<LibraryScreen />);

      await fireEvent.press(screen.getByText('Downloaded'));

      expect(
        screen.getByText('No downloads yet. Press and hold a story, or tap the more button on a card, and choose Download.'),
      ).toBeOnTheScreen();
      expect(screen.queryByText(/^\d+ stor(y|ies) · /)).not.toBeOnTheScreen();
    });

    it('the filter is exclusive with Favorites', async () => {
      mockLibrary.favorites = ['a'];
      mockDownloads.downloaded = { b: { sizeBytes: MB } };
      await render(<LibraryScreen />);

      await fireEvent.press(screen.getByText('Downloaded (1)'));
      expect(screen.getByRole('button', { name: 'Downloaded (1)', selected: true })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: '♥ Favorites (1)', selected: false })).toBeOnTheScreen();

      await fireEvent.press(screen.getByText('♥ Favorites (1)'));
      expect(screen.getByRole('button', { name: 'Downloaded (1)', selected: false })).toBeOnTheScreen();
      expect(screen.getByText('Story A')).toBeOnTheScreen();
      expect(screen.queryByText('Story B')).not.toBeOnTheScreen();
      expect(screen.queryByText(/^\d+ stor(y|ies) · /)).not.toBeOnTheScreen();
    });

    it('still renders the Bedtime entry beside the three filters', async () => {
      await render(<LibraryScreen />);

      expect(screen.getByRole('button', { name: 'Bedtime' })).toBeOnTheScreen();
      expect(screen.getAllByRole('button', { name: /^(All stories|♥ Favorites|Downloaded)/ })).toHaveLength(3);
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
