import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { RepeatMode } from '../lib/playlist';
import { useQueue } from '../lib/QueueProvider';
import { PlaybackModeChips } from './PlaybackModeChips';

jest.mock('../lib/QueueProvider', () => ({ useQueue: jest.fn() }));

const setup = async (shuffle = false, repeat: RepeatMode = 'off') => {
  const setShuffle = jest.fn();
  const setRepeat = jest.fn();
  jest.mocked(useQueue).mockReturnValue({ shuffle, repeat, setShuffle, setRepeat } as unknown as ReturnType<typeof useQueue>);
  await render(<PlaybackModeChips />);
  return { setShuffle, setRepeat };
};

describe('PlaybackModeChips', () => {
  it('renders three buttons with labels and 44pt minimum targets', async () => {
    await setup();

    for (const name of ['Shuffle', 'Repeat all', 'Repeat one']) {
      const chip = screen.getByRole('button', { name });
      expect(chip).toBeOnTheScreen();
      expect(StyleSheet.flatten(chip.props.style).minHeight).toBeGreaterThanOrEqual(44);
    }
  });

  it('chip selected states follow shuffle and repeat', async () => {
    await setup(true, 'one');

    expect(screen.getByRole('button', { name: 'Shuffle' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Repeat all' })).not.toBeSelected();
    expect(screen.getByRole('button', { name: 'Repeat one' })).toBeSelected();
  });

  it('pressing Shuffle toggles it', async () => {
    const { setShuffle } = await setup(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Shuffle' }));
    expect(setShuffle).toHaveBeenCalledWith(true);

    jest.mocked(useQueue).mockReturnValue({ shuffle: true, repeat: 'off', setShuffle, setRepeat: jest.fn() } as unknown as ReturnType<typeof useQueue>);
    await screen.rerender(<PlaybackModeChips />);
    await fireEvent.press(screen.getByRole('button', { name: 'Shuffle' }));
    expect(setShuffle).toHaveBeenLastCalledWith(false);
  });

  it('pressing Repeat all selects it and pressing it again turns repeat off', async () => {
    const { setRepeat } = await setup(false, 'off');
    await fireEvent.press(screen.getByRole('button', { name: 'Repeat all' }));
    expect(setRepeat).toHaveBeenCalledWith('all');

    jest.mocked(useQueue).mockReturnValue({ shuffle: false, repeat: 'all', setShuffle: jest.fn(), setRepeat } as unknown as ReturnType<typeof useQueue>);
    await screen.rerender(<PlaybackModeChips />);
    await fireEvent.press(screen.getByRole('button', { name: 'Repeat all' }));
    expect(setRepeat).toHaveBeenLastCalledWith('off');
  });

  it('pressing Repeat one while Repeat all is selected switches to one', async () => {
    const { setRepeat } = await setup(false, 'all');
    await fireEvent.press(screen.getByRole('button', { name: 'Repeat one' }));
    expect(setRepeat).toHaveBeenCalledWith('one');
  });

  it('pressing Repeat all while Repeat one is selected switches to all', async () => {
    const { setRepeat } = await setup(false, 'one');
    await fireEvent.press(screen.getByRole('button', { name: 'Repeat all' }));
    expect(setRepeat).toHaveBeenCalledWith('all');
  });

  it('pressing Repeat one while repeat is off selects one', async () => {
    const { setRepeat } = await setup(false, 'off');
    await fireEvent.press(screen.getByRole('button', { name: 'Repeat one' }));
    expect(setRepeat).toHaveBeenCalledWith('one');
  });

  it('pressing Repeat one while it is selected turns repeat off', async () => {
    const { setRepeat } = await setup(false, 'one');
    await fireEvent.press(screen.getByRole('button', { name: 'Repeat one' }));
    expect(setRepeat).toHaveBeenCalledWith('off');
  });

  it('selected chips show the non-colour dot', async () => {
    await setup(true, 'all');

    expect(screen.getByTestId('chip-active-indicator-shuffle')).toBeOnTheScreen();
    expect(screen.getByTestId('chip-active-indicator-repeat-all')).toBeOnTheScreen();
    expect(screen.queryByTestId('chip-active-indicator-repeat-one')).not.toBeOnTheScreen();
  });

  it('chips show no visible text', async () => {
    await setup(true, 'one');

    expect(screen.queryByText('Shuffle')).not.toBeOnTheScreen();
    expect(screen.queryByText('Repeat all')).not.toBeOnTheScreen();
    expect(screen.queryByText('Repeat one')).not.toBeOnTheScreen();
  });
});
