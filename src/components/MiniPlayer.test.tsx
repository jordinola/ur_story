import { fireEvent, render, screen } from '@testing-library/react-native';
import { router, usePathname } from 'expo-router';
import { makeStory } from '../test/fixtures';
import { MiniPlayer } from './MiniPlayer';

const mockPlayer = {
  current: makeStory() as ReturnType<typeof makeStory> | null,
  isPlaying: false,
  position: 30,
  duration: 300,
  toggle: jest.fn(),
};

const mockQueue = {
  upNext: null as ReturnType<typeof makeStory> | null,
  gapRemainingSec: null as number | null,
  cancelUpNext: jest.fn(),
};

jest.mock('../lib/QueueProvider', () => ({ useQueue: () => mockQueue }));
jest.mock('../lib/PlayerProvider', () => ({ usePlayer: () => mockPlayer }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  usePathname: jest.fn(() => '/'),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockPlayer.current = makeStory();
  mockPlayer.isPlaying = false;
  mockQueue.upNext = null;
  mockQueue.gapRemainingSec = null;
  (usePathname as jest.Mock).mockReturnValue('/');
});

describe('MiniPlayer', () => {
  it('renders nothing when no story is loaded', async () => {
    mockPlayer.current = null;
    await render(<MiniPlayer />);

    expect(screen.queryByText('The Sleepy Moon')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('renders nothing on the story screen', async () => {
    (usePathname as jest.Mock).mockReturnValue('/story/story-1');
    await render(<MiniPlayer />);

    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('shows the current story title and emoji elsewhere', async () => {
    await render(<MiniPlayer />);

    expect(screen.getByText('The Sleepy Moon')).toBeOnTheScreen();
    expect(screen.getByText('🌙')).toBeOnTheScreen();
  });

  it('toggles playback from the play/pause button', async () => {
    await render(<MiniPlayer />);

    await fireEvent.press(screen.getByRole('button', { name: 'Play' }));

    expect(mockPlayer.toggle).toHaveBeenCalledTimes(1);
  });

  it('labels the button Pause while playing', async () => {
    mockPlayer.isPlaying = true;
    await render(<MiniPlayer />);

    expect(screen.getByRole('button', { name: 'Pause' })).toBeOnTheScreen();
  });

  it('opens the story screen when the info area is tapped', async () => {
    await render(<MiniPlayer />);

    await fireEvent.press(screen.getByRole('button', { name: 'Open The Sleepy Moon' }));

    expect(router.push).toHaveBeenCalledWith({ pathname: '/story/[id]', params: { id: 'story-1' } });
  });

  it('shows the banner while a gap counts', async () => {
    mockQueue.upNext = makeStory({ id: 'story-2', title: 'Brave Bear' });
    mockQueue.gapRemainingSec = 3;
    await render(<MiniPlayer />);

    expect(screen.getByText('Up next: Brave Bear in 3')).toBeOnTheScreen();
  });
});
