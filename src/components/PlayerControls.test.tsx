import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { PlayerControls } from './PlayerControls';

const mockPlayer = {
  isPlaying: false,
  isLoading: false,
  position: 65,
  duration: 300,
  error: null as string | null,
  toggle: jest.fn(),
  seekBy: jest.fn(),
  seekTo: jest.fn(),
  sleepMinutes: null as number | null,
  sleepRemainingSec: null as number | null,
  setSleepTimer: jest.fn(),
  playbackRate: 1,
  setPlaybackRate: jest.fn(),
};

jest.mock('../lib/PlayerProvider', () => ({ usePlayer: () => mockPlayer }));

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockPlayer, {
    isPlaying: false,
    isLoading: false,
    position: 65,
    duration: 300,
    error: null,
    sleepMinutes: null,
    sleepRemainingSec: null,
    playbackRate: 1,
  });
});

describe('PlayerControls speed chips', () => {
  it('offers 0.75x, 1x and 1.25x with the current rate selected', async () => {
    mockPlayer.playbackRate = 1.25;
    await render(<PlayerControls />);

    expect(screen.getByLabelText('0.75x speed')).toBeOnTheScreen();
    expect(screen.getByLabelText('1x speed')).toBeOnTheScreen();
    expect(screen.getByLabelText('1.25x speed').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByLabelText('1x speed').props.accessibilityState).toEqual({ selected: false });
  });

  it('keeps chips at least 44pt tall', async () => {
    await render(<PlayerControls />);

    const chip = screen.getByLabelText('1x speed');
    expect(StyleSheet.flatten(chip.props.style).minHeight).toBeGreaterThanOrEqual(44);
  });

  it('sets the rate when a chip is pressed', async () => {
    await render(<PlayerControls />);

    await fireEvent.press(screen.getByLabelText('0.75x speed'));

    expect(mockPlayer.setPlaybackRate).toHaveBeenCalledWith(0.75);
  });
});

describe('PlayerControls', () => {
  it('shows the formatted position and duration', async () => {
    await render(<PlayerControls />);

    expect(screen.getByText('1:05')).toBeOnTheScreen();
    expect(screen.getByText('5:00')).toBeOnTheScreen();
  });

  it('toggles playback from the play button', async () => {
    await render(<PlayerControls />);

    await fireEvent.press(screen.getByRole('button', { name: 'Play' }));

    expect(mockPlayer.toggle).toHaveBeenCalledTimes(1);
  });

  it('labels the main button Pause while playing', async () => {
    mockPlayer.isPlaying = true;
    await render(<PlayerControls />);

    expect(screen.getByRole('button', { name: 'Pause' })).toBeOnTheScreen();
  });

  it('shows a loading indicator while loading and not playing', async () => {
    mockPlayer.isLoading = true;
    await render(<PlayerControls />);

    expect(screen.getByText('…')).toBeOnTheScreen();
  });

  it('skips back and forward 15 seconds', async () => {
    await render(<PlayerControls />);

    await fireEvent.press(screen.getByRole('button', { name: 'Back 15 seconds' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Forward 15 seconds' }));

    expect(mockPlayer.seekBy).toHaveBeenNthCalledWith(1, -15);
    expect(mockPlayer.seekBy).toHaveBeenNthCalledWith(2, 15);
  });

  it('seeks proportionally when the progress bar is tapped', async () => {
    await render(<PlayerControls />);
    const bar = screen.getByLabelText('Playback position');
    await fireEvent(screen.getByLabelText('Playback position').children[0] as never, 'layout', {
      nativeEvent: { layout: { width: 200 } },
    });

    await fireEvent.press(bar, { nativeEvent: { locationX: 50 } });

    expect(mockPlayer.seekTo).toHaveBeenCalledWith(75);
  });

  it('does not seek before the bar has been laid out', async () => {
    await render(<PlayerControls />);

    await fireEvent.press(screen.getByLabelText('Playback position'), { nativeEvent: { locationX: 50 } });

    expect(mockPlayer.seekTo).not.toHaveBeenCalled();
  });

  describe('sleep timer', () => {
    it('offers 10, 20 and 30 minute options', async () => {
      await render(<PlayerControls />);

      expect(screen.getByText('Sleep timer')).toBeOnTheScreen();
      for (const label of ['10m', '20m', '30m']) {
        expect(screen.getByText(label)).toBeOnTheScreen();
      }
    });

    it('sets the timer when an option is tapped', async () => {
      await render(<PlayerControls />);

      await fireEvent.press(screen.getByText('20m'));

      expect(mockPlayer.setSleepTimer).toHaveBeenCalledWith(20);
    });

    it('cancels the timer when the active option is tapped again', async () => {
      mockPlayer.sleepMinutes = 20;
      await render(<PlayerControls />);

      await fireEvent.press(screen.getByText('20m'));

      expect(mockPlayer.setSleepTimer).toHaveBeenCalledWith(null);
    });

    it('marks the active option as selected', async () => {
      mockPlayer.sleepMinutes = 10;
      await render(<PlayerControls />);

      expect(screen.getByRole('button', { name: '10m', selected: true })).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: '20m', selected: true })).toBeNull();
    });

    it('shows the remaining time when a timer is running', async () => {
      mockPlayer.sleepMinutes = 10;
      mockPlayer.sleepRemainingSec = 125;
      await render(<PlayerControls />);

      expect(screen.getByText('Sleep in 2:05')).toBeOnTheScreen();
    });
  });

  it('shows an error message when the player reports one', async () => {
    mockPlayer.error = 'Could not load this story.';
    await render(<PlayerControls />);

    expect(screen.getByText('Could not load this story.')).toBeOnTheScreen();
  });
});
