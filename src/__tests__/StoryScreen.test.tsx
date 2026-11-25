import { fireEvent, render, screen, within } from '@testing-library/react-native';
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
  error: null as string | null,
  toggle: jest.fn(),
  seekBy: jest.fn(),
  seekTo: jest.fn(),
  playbackRate: 1,
  setPlaybackRate: jest.fn(),
  sleepMinutes: null,
  sleepRemainingSec: null,
  setSleepTimer: jest.fn(),
};

jest.mock('../lib/LibraryProvider', () => ({ useLibrary: () => mockLibrary }));
const mockQueue = {
  queue: [] as (typeof story)[],
  upNext: null as typeof story | null,
  gapRemainingSec: null as number | null,
  cancelUpNext: jest.fn(),
  playNextNow: jest.fn(),
  playNow: jest.fn(),
  moveToTop: jest.fn(),
  remove: jest.fn(),
};
jest.mock('../lib/QueueProvider', () => ({ useQueue: () => mockQueue }));
jest.mock('../lib/PlayerProvider', () => ({ usePlayer: () => mockPlayer }));
jest.mock('../lib/BedtimeProvider', () => ({
  useBedtime: () => ({ active: false, locked: false, remainingSec: null }),
}));
// Reduce Motion on, so toggling the queue view never configures a layout animation.
jest.mock('../lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
  Stack: { Screen: () => null },
}));

// Spy on Dimensions (a shared object) rather than useWindowDimensions: `import * as RN` gets an
// interop copy of the CommonJS module, so a spy on it never reaches the screen's own import.
function setWidth(width: number, height = 800) {
  jest.spyOn(RN.Dimensions, 'get').mockReturnValue({ width, height, scale: 2, fontScale: 1 });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPlayer.current = null;
  mockPlayer.error = null;
  mockLibrary.ready = true;
  mockLibrary.stories = [story];
  mockLibrary.isFavorite.mockReturnValue(false);
  mockQueue.upNext = null;
  mockQueue.gapRemainingSec = null;
  (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'story-1' });
  setWidth(390);
});

const scrollArea = () => within(screen.getByTestId('story-scroll'));
const footer = () => within(screen.getByTestId('story-footer'));

describe('StoryScreen', () => {
  describe('narrow screen: transport pinned below the scroll area', () => {
    const transport = ['Previous story', 'Play', 'Next story'];

    it('keeps the transport and seek bar outside the scroll area in the cover view', async () => {
      await render(<StoryScreen />);

      for (const name of transport) {
        expect(footer().getByRole('button', { name })).toBeOnTheScreen();
        expect(scrollArea().queryByRole('button', { name })).not.toBeOnTheScreen();
      }
      expect(footer().getByLabelText('Playback position')).toBeOnTheScreen();
      expect(scrollArea().queryByLabelText('Playback position')).not.toBeOnTheScreen();
      expect(scrollArea().getByRole('button', { name: 'Show queue' })).toBeOnTheScreen();
      expect(scrollArea().getByText('The Sleepy Moon')).toBeOnTheScreen();
      expect(scrollArea().getByRole('button', { name: 'Add to favorites' })).toBeOnTheScreen();
      expect(scrollArea().getByText('A moon who cannot sleep.')).toBeOnTheScreen();
    });

    it('keeps the transport outside the scroll area in the queue view', async () => {
      await render(<StoryScreen />);
      await fireEvent.press(screen.getByRole('button', { name: 'Show queue' }));

      for (const name of transport) {
        expect(footer().getByRole('button', { name })).toBeOnTheScreen();
        expect(scrollArea().queryByRole('button', { name })).not.toBeOnTheScreen();
      }
      expect(scrollArea().getByRole('button', { name: 'The Sleepy Moon, show cover' })).toBeOnTheScreen();
      expect(scrollArea().getByRole('header', { name: 'Up next' })).toBeOnTheScreen();
      expect(screen.getAllByRole('button', { name: 'Play' })).toHaveLength(1);
    });

    it('shows the up-next banner in the pinned footer in both views', async () => {
      mockQueue.upNext = makeStory({ id: 'story-2', title: 'Brave Bear' });
      mockQueue.gapRemainingSec = 4;
      await render(<StoryScreen />);

      expect(footer().getByText('Up next: Brave Bear in 4')).toBeOnTheScreen();
      expect(scrollArea().queryByText('Up next: Brave Bear in 4')).not.toBeOnTheScreen();

      await fireEvent.press(screen.getByRole('button', { name: 'Show queue' }));

      expect(footer().getByText('Up next: Brave Bear in 4')).toBeOnTheScreen();
      expect(scrollArea().queryByText('Up next: Brave Bear in 4')).not.toBeOnTheScreen();
    });

    it('shows the player error inside the pinned footer', async () => {
      mockPlayer.error = 'Could not load this story.';
      await render(<StoryScreen />);

      expect(footer().getByText('Could not load this story.')).toBeOnTheScreen();
      expect(scrollArea().queryByText('Could not load this story.')).not.toBeOnTheScreen();
    });

    it('places the footer between the scroll area and the bottom bar', async () => {
      await render(<StoryScreen />);

      const order = screen
        .getAllByTestId(/^(story-scroll|story-footer|player-bottom-bar)$/)
        .map((node) => node.props.testID);

      expect(order).toEqual(['story-scroll', 'story-footer', 'player-bottom-bar']);
    });

    it('keeps the footer shrinkable so it cannot push the bottom bar off screen', async () => {
      setWidth(390, 844);
      await render(<StoryScreen />);

      const style = RN.StyleSheet.flatten(screen.getByTestId('story-footer').props.style);
      expect(style.maxHeight).toBe(422);
      expect(style.flexShrink).toBe(1);
    });

    it('keeps the pinned footer on a narrow portrait phone', async () => {
      setWidth(390, 844);
      await render(<StoryScreen />);

      expect(screen.getByTestId('story-footer')).toBeOnTheScreen();
    });

    it('uses the two-pane layout with no footer on a landscape iPhone SE', async () => {
      setWidth(667, 375);
      await render(<StoryScreen />);

      expect(screen.queryByTestId('story-footer')).not.toBeOnTheScreen();
      expect(scrollArea().getByRole('button', { name: 'Play' })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Queue' })).toBeOnTheScreen();
    });

    it('has no -15 or +15 buttons', async () => {
      await render(<StoryScreen />);

      expect(screen.queryByRole('button', { name: 'Back 15 seconds' })).not.toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Forward 15 seconds' })).not.toBeOnTheScreen();
    });

    it('shows the empty queue state and a disabled Next in the queue view', async () => {
      await render(<StoryScreen />);
      await fireEvent.press(screen.getByRole('button', { name: 'Show queue' }));

      expect(scrollArea().getByText('Your queue is empty')).toBeOnTheScreen();
      expect(scrollArea().getByText('Press and hold a story, or tap ⋯ on a card, to add it.')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Next story' })).toBeDisabled();
    });
  });

  it('shows the big cover, title and description by default', async () => {
    await render(<StoryScreen />);

    expect(screen.getByRole('button', { name: 'Show queue' })).toBeOnTheScreen();
    expect(screen.getByText('The Sleepy Moon')).toBeOnTheScreen();
    expect(screen.getByText('5 min · Ages 3-6')).toBeOnTheScreen();
    expect(screen.getByText('A moon who cannot sleep.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Play' })).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Up next' })).not.toBeOnTheScreen();
  });

  it('tapping the cover opens the queue view and hides the description', async () => {
    await render(<StoryScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Show queue' }));

    expect(screen.getByRole('header', { name: 'Up next' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'The Sleepy Moon, show cover' })).toBeOnTheScreen();
    expect(screen.queryByText('A moon who cannot sleep.')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Add to favorites' })).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Next story' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'The Sleepy Moon, show cover' }));

    expect(screen.getByText('A moon who cannot sleep.')).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Up next' })).not.toBeOnTheScreen();
  });

  it('the Queue button toggles the queue view', async () => {
    await render(<StoryScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Queue', selected: false }));
    expect(screen.getByRole('header', { name: 'Up next' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Queue', selected: true })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Queue' }));
    expect(screen.queryByRole('header', { name: 'Up next' })).not.toBeOnTheScreen();
    expect(screen.getByText('A moon who cannot sleep.')).toBeOnTheScreen();
  });

  it('More opens the sheet with Speed and Sleep', async () => {
    await render(<StoryScreen />);
    expect(screen.queryByText('Speed')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'More' }));

    expect(screen.getByText('Speed')).toBeOnTheScreen();
    expect(screen.getByText('Sleep timer')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('Speed')).not.toBeOnTheScreen();
  });

  it('the favorite heart still toggles', async () => {
    await render(<StoryScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Add to favorites' }));

    expect(mockLibrary.toggleFavorite).toHaveBeenCalledWith('story-1');
  });

  it('the bottom bar is present in both views', async () => {
    await render(<StoryScreen />);
    expect(screen.getByRole('button', { name: 'Queue' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'More' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Show queue' }));

    expect(screen.getByRole('button', { name: 'Queue' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'More' })).toBeOnTheScreen();
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

  it('does not call play again after the route param changes to the already-playing story', async () => {
    const next = makeStory({ id: 'story-2', title: 'Brave Bear' });
    mockLibrary.stories = [story, next];
    mockLibrary.getStory.mockImplementation((id: string) => [story, next].find((s) => s.id === id));
    mockPlayer.current = story;
    const { rerender } = await render(<StoryScreen />);

    mockPlayer.current = next;
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'story-2' });
    await rerender(<StoryScreen />);

    expect(screen.getByText('Brave Bear')).toBeOnTheScreen();
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
    expect(screen.getByText('A moon who cannot sleep.')).toBeOnTheScreen();
  });

  it('keeps the transport in the right pane on a wide screen, with no pinned footer', async () => {
    setWidth(1024);
    await render(<StoryScreen />);

    expect(scrollArea().getByRole('button', { name: 'Play' })).toBeOnTheScreen();
    expect(screen.queryByTestId('story-footer')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Back 15 seconds' })).not.toBeOnTheScreen();
  });

  it('keeps the title and description beside the queue on a wide screen', async () => {
    setWidth(1024);
    await render(<StoryScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Show queue' }));

    expect(screen.getByRole('header', { name: 'Up next' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'The Sleepy Moon, show cover' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add to favorites' })).toBeOnTheScreen();
    expect(screen.getByText('A moon who cannot sleep.')).toBeOnTheScreen();
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
