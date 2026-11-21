import { fireEvent, render, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import * as RN from 'react-native';
import StoryScreen from '../app/story/[id]';
import { makeStory } from '../test/fixtures';

const story = makeStory({ id: 'story-1' });

const mockLibrary = {
  getStory: jest.fn((id: string) => (id === story.id ? story : undefined)),
  isFavorite: jest.fn(() => false),
  toggleFavorite: jest.fn(),
  ready: true,
  stories: [story],
};

const mockPlayer = {
  current: null as typeof story | null,
  play: jest.fn(),
  isPlaying: false,
  isLoading: false,
  position: 0,
  duration: 300,
  error: null,
  toggle: jest.fn(),
  seekBy: jest.fn(),
  seekTo: jest.fn(),
  sleepMinutes: null,
  sleepRemainingSec: null,
  setSleepTimer: jest.fn(),
};

jest.mock('../lib/LibraryProvider', () => ({ useLibrary: () => mockLibrary }));
jest.mock('../lib/PlayerProvider', () => ({ usePlayer: () => mockPlayer }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
  Stack: { Screen: () => null },
}));

function setWidth(width: number) {
  jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width, height: 800, scale: 2, fontScale: 1 });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPlayer.current = null;
  mockLibrary.ready = true;
  mockLibrary.stories = [story];
  mockLibrary.isFavorite.mockReturnValue(false);
  (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'story-1' });
  setWidth(390);
});

describe('StoryScreen', () => {
  it('shows the story details and player controls', async () => {
    await render(<StoryScreen />);

    expect(screen.getByText('The Sleepy Moon')).toBeOnTheScreen();
    expect(screen.getByText('5 min · Ages 3-6')).toBeOnTheScreen();
    expect(screen.getByText('A moon who cannot sleep.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Play' })).toBeOnTheScreen();
  });

  it('starts playing a story that is not already loaded', async () => {
    await render(<StoryScreen />);

    expect(mockPlayer.play).toHaveBeenCalledWith(story);
  });

  it('does not restart a story that is already the current one', async () => {
    mockPlayer.current = story;
    await render(<StoryScreen />);

    expect(mockPlayer.play).not.toHaveBeenCalled();
  });

  it('toggles favorite from the heart button', async () => {
    await render(<StoryScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Add to favorites' }));

    expect(mockLibrary.toggleFavorite).toHaveBeenCalledWith('story-1');
  });

  it('shows the filled heart for favorite stories', async () => {
    mockLibrary.isFavorite.mockReturnValue(true);
    await render(<StoryScreen />);

    expect(screen.getByRole('button', { name: 'Remove from favorites' })).toBeOnTheScreen();
  });

  it('renders both panes on a wide screen', async () => {
    setWidth(1024);
    await render(<StoryScreen />);

    expect(screen.getByText('The Sleepy Moon')).toBeOnTheScreen();
    expect(screen.getByText('🌙')).toBeOnTheScreen();
  });

  describe('missing story', () => {
    beforeEach(() => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'unknown' });
    });

    it('says the story was not found once the library is loaded', async () => {
      await render(<StoryScreen />);

      expect(screen.getByText('Story not found.')).toBeOnTheScreen();
      expect(mockPlayer.play).not.toHaveBeenCalled();
    });

    it('shows a loading message while the library is still loading', async () => {
      mockLibrary.ready = false;
      mockLibrary.stories = [];
      await render(<StoryScreen />);

      expect(screen.getByText('Loading…')).toBeOnTheScreen();
    });
  });
});
