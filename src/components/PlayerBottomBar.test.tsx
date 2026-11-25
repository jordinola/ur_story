import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { PlayerBottomBar } from './PlayerBottomBar';

const setup = async (queueOpen = false) => {
  const onToggleQueue = jest.fn();
  const onOpenMore = jest.fn();
  await render(<PlayerBottomBar queueOpen={queueOpen} onToggleQueue={onToggleQueue} onOpenMore={onOpenMore} />);
  return { onToggleQueue, onOpenMore };
};

describe('PlayerBottomBar', () => {
  it('renders Queue and More buttons with labels', async () => {
    await setup();

    expect(screen.getByRole('button', { name: 'Queue' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'More' })).toBeOnTheScreen();
  });

  it('Queue reflects queueOpen in its selected state', async () => {
    await setup(true);
    expect(screen.getByRole('button', { name: 'Queue' })).toBeSelected();

    await screen.rerender(<PlayerBottomBar queueOpen={false} onToggleQueue={jest.fn()} onOpenMore={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Queue' })).not.toBeSelected();
  });

  it('shows a non-color active indicator only when the queue is open', async () => {
    await setup(true);
    expect(screen.getByTestId('queue-active-indicator')).toBeOnTheScreen();

    await screen.rerender(<PlayerBottomBar queueOpen={false} onToggleQueue={jest.fn()} onOpenMore={jest.fn()} />);
    expect(screen.queryByTestId('queue-active-indicator')).not.toBeOnTheScreen();
  });

  it('pressing Queue calls onToggleQueue', async () => {
    const { onToggleQueue, onOpenMore } = await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Queue' }));

    expect(onToggleQueue).toHaveBeenCalledTimes(1);
    expect(onOpenMore).not.toHaveBeenCalled();
  });

  it('pressing More calls onOpenMore', async () => {
    const { onToggleQueue, onOpenMore } = await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'More' }));

    expect(onOpenMore).toHaveBeenCalledTimes(1);
    expect(onToggleQueue).not.toHaveBeenCalled();
  });

  it('shows no visible text labels', async () => {
    await setup();

    expect(screen.getByText('☰')).toBeOnTheScreen();
    expect(screen.getByText('•••')).toBeOnTheScreen();
    expect(screen.queryByText('Queue')).not.toBeOnTheScreen();
    expect(screen.queryByText('More')).not.toBeOnTheScreen();
  });

  it('centers the two icons as a group with space between them', async () => {
    await setup();

    const style = StyleSheet.flatten(screen.getByTestId('player-bottom-bar').props.style);
    expect(style.justifyContent).toBe('center');
    expect(style.gap).toBe(64);
  });

  it('keeps both targets at least 44pt', async () => {
    await setup();

    for (const name of ['Queue', 'More']) {
      const style = StyleSheet.flatten(screen.getByRole('button', { name }).props.style);
      expect(style.minWidth).toBeGreaterThanOrEqual(44);
      expect(style.minHeight).toBeGreaterThanOrEqual(44);
    }
  });
});
