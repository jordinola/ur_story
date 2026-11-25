import { fireEvent, render, screen } from '@testing-library/react-native';
import { makeStory } from '../test/fixtures';
import { NowPlayingCover } from './NowPlayingCover';

const story = makeStory({ id: 'story-1' });

const mockPlayer = {
  isPlaying: false,
  position: 65,
  duration: 300,
  toggle: jest.fn(),
};

jest.mock('../lib/PlayerProvider', () => ({ usePlayer: () => mockPlayer }));

beforeEach(() => {
  jest.clearAllMocks();
  mockPlayer.isPlaying = false;
});

describe('NowPlayingCover', () => {
  describe('big cover', () => {
    it('shows the cover with the Show queue label', async () => {
      await render(<NowPlayingCover story={story} size={300} compact={false} onToggle={jest.fn()} />);

      expect(screen.getByRole('button', { name: 'Show queue' })).toBeOnTheScreen();
      expect(screen.getByText('🌙')).toBeOnTheScreen();
    });

    it('calls onToggle when tapped', async () => {
      const onToggle = jest.fn();
      await render(<NowPlayingCover story={story} size={300} compact={false} onToggle={onToggle} />);

      await fireEvent.press(screen.getByRole('button', { name: 'Show queue' }));

      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('compact row', () => {
    it('shows the title and the position and duration', async () => {
      await render(<NowPlayingCover story={story} size={300} compact onToggle={jest.fn()} />);

      expect(screen.getByText('The Sleepy Moon')).toBeOnTheScreen();
      expect(screen.getByText('1:05 / 5:00')).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Show queue' })).not.toBeOnTheScreen();
    });

    it('has no play/pause button of its own (the pinned transport has it)', async () => {
      await render(<NowPlayingCover story={story} size={300} compact onToggle={jest.fn()} />);

      expect(screen.queryByRole('button', { name: 'Play' })).not.toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeOnTheScreen();
      expect(screen.getAllByRole('button')).toHaveLength(1);
    });

    it('tapping the row calls onToggle', async () => {
      const onToggle = jest.fn();
      await render(<NowPlayingCover story={story} size={300} compact onToggle={onToggle} />);

      await fireEvent.press(screen.getByRole('button', { name: 'The Sleepy Moon, show cover' }));

      expect(onToggle).toHaveBeenCalledTimes(1);
      expect(mockPlayer.toggle).not.toHaveBeenCalled();
    });
  });
});
