import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { colors } from '../theme';
import { TransportControls } from './TransportControls';

const mockPlayer = {
  isPlaying: false,
  isLoading: false,
  position: 65,
  duration: 300,
  error: null as string | null,
  toggle: jest.fn(),
  seekBy: jest.fn(),
  seekTo: jest.fn(),
};
const mockQueue = { canNext: true, playNextNow: jest.fn(), playPrevious: jest.fn() };

jest.mock('../lib/PlayerProvider', () => ({ usePlayer: () => mockPlayer }));
jest.mock('../lib/QueueProvider', () => ({ useQueue: () => mockQueue }));

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockPlayer, { isPlaying: false, isLoading: false, position: 65, duration: 300, error: null });
  mockQueue.canNext = true;
});

describe('TransportControls', () => {
  it('shows the formatted position and duration', async () => {
    await render(<TransportControls />);

    expect(screen.getByText('1:05')).toBeOnTheScreen();
    expect(screen.getByText('5:00')).toBeOnTheScreen();
  });

  it('Previous calls playPrevious', async () => {
    await render(<TransportControls />);

    await fireEvent.press(screen.getByRole('button', { name: 'Previous story' }));

    expect(mockQueue.playPrevious).toHaveBeenCalledTimes(1);
    expect(mockPlayer.seekTo).not.toHaveBeenCalled();
  });

  it('draws Previous, Play and Next as icons instead of text glyphs', async () => {
    await render(<TransportControls />);

    const icon = (name: string) => screen.getByTestId(`transport-icon-${name}`, { includeHiddenElements: true });
    expect(screen.getByRole('button', { name: 'Previous story' })).toContainElement(icon('previous'));
    expect(screen.getByRole('button', { name: 'Play' })).toContainElement(icon('play'));
    expect(screen.getByRole('button', { name: 'Next story' })).toContainElement(icon('next'));
    for (const glyph of ['⏮', '▶', '⏭', '❚❚']) {
      expect(screen.queryByText(glyph, { includeHiddenElements: true })).not.toBeOnTheScreen();
    }
  });

  it('colors the skip icons with the text color and the play icon with the primary text color', async () => {
    await render(<TransportControls />);

    const part = (icon: string, testID: string) =>
      StyleSheet.flatten(
        within(screen.getByTestId(`transport-icon-${icon}`, { includeHiddenElements: true })).getAllByTestId(testID, {
          includeHiddenElements: true,
        })[0].props.style,
      );
    expect(part('previous', 'transport-icon-bar').backgroundColor).toBe(colors.text);
    expect(part('next', 'transport-icon-bar').backgroundColor).toBe(colors.text);
    expect(part('play', 'transport-icon-triangle').borderLeftColor).toBe(colors.primaryText);
  });

  it('Next plays the next queued story', async () => {
    await render(<TransportControls />);

    await fireEvent.press(screen.getByRole('button', { name: 'Next story' }));

    expect(mockQueue.playNextNow).toHaveBeenCalledTimes(1);
  });

  it('Next is enabled with Repeat all and an empty queue', async () => {
    mockQueue.canNext = true;
    await render(<TransportControls />);

    const next = screen.getByLabelText('Next story');
    expect(next).toBeEnabled();
    await fireEvent.press(next);

    expect(mockQueue.playNextNow).toHaveBeenCalledTimes(1);
  });

  it('Next stays dimmed with an empty queue and Repeat off', async () => {
    mockQueue.canNext = false;
    await render(<TransportControls />);

    const next = screen.getByLabelText('Next story');
    expect(next.props.accessibilityState).toEqual({ disabled: true });
    expect(StyleSheet.flatten(next.props.style).opacity).toBeLessThan(1);
    await fireEvent.press(next);

    expect(mockQueue.playNextNow).not.toHaveBeenCalled();
  });

  it('play/pause toggles and shows the right label', async () => {
    const view = await render(<TransportControls />);

    await fireEvent.press(screen.getByRole('button', { name: 'Play' }));
    expect(mockPlayer.toggle).toHaveBeenCalledTimes(1);

    mockPlayer.isPlaying = true;
    await view.rerender(<TransportControls />);
    expect(screen.getByRole('button', { name: 'Pause' })).toContainElement(
      screen.getByTestId('transport-icon-pause', { includeHiddenElements: true }),
    );
  });

  it('shows a loading indicator while loading and not playing', async () => {
    mockPlayer.isLoading = true;
    await render(<TransportControls />);

    expect(screen.getByText('…')).toBeOnTheScreen();
    expect(screen.queryByTestId('transport-icon-play', { includeHiddenElements: true })).not.toBeOnTheScreen();
  });

  it('has no -15 or +15 buttons', async () => {
    await render(<TransportControls />);

    expect(screen.queryByRole('button', { name: 'Back 15 seconds' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Forward 15 seconds' })).not.toBeOnTheScreen();
    expect(screen.queryByText('−15')).not.toBeOnTheScreen();
    expect(screen.queryByText('+15')).not.toBeOnTheScreen();
  });

  it('keeps every button at least 44pt', async () => {
    await render(<TransportControls />);

    for (const name of ['Previous story', 'Play', 'Next story']) {
      const style = StyleSheet.flatten(screen.getByRole('button', { name }).props.style);
      expect(style.width).toBeGreaterThanOrEqual(44);
      expect(style.height).toBeGreaterThanOrEqual(44);
    }
  });

  it('seek bar tap seeks proportionally', async () => {
    await render(<TransportControls />);
    const bar = screen.getByLabelText('Playback position');
    await fireEvent(bar.children[0] as never, 'layout', { nativeEvent: { layout: { width: 200 } } });

    await fireEvent.press(bar, { nativeEvent: { locationX: 50 } });

    expect(mockPlayer.seekTo).toHaveBeenCalledWith(75);
  });

  it('does not seek before the bar has been laid out', async () => {
    await render(<TransportControls />);

    await fireEvent.press(screen.getByLabelText('Playback position'), { nativeEvent: { locationX: 50 } });

    expect(mockPlayer.seekTo).not.toHaveBeenCalled();
  });

  it('shows the player error', async () => {
    mockPlayer.error = 'Could not load this story.';
    await render(<TransportControls />);

    expect(screen.getByText('Could not load this story.')).toBeOnTheScreen();
  });

  it('exposes the position as an adjustable value for VoiceOver', async () => {
    await render(<TransportControls />);

    const bar = screen.getByLabelText('Playback position');
    expect(bar.props.accessibilityValue).toEqual({ text: '1:05 of 5:00' });
    expect(bar.props.accessibilityActions).toEqual([{ name: 'increment' }, { name: 'decrement' }]);
  });

  it('seeks forward and back 15 seconds with the increment and decrement actions', async () => {
    await render(<TransportControls />);
    const bar = screen.getByLabelText('Playback position');

    await fireEvent(bar, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(mockPlayer.seekBy).toHaveBeenLastCalledWith(15);

    await fireEvent(bar, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(mockPlayer.seekBy).toHaveBeenLastCalledWith(-15);
  });
});
