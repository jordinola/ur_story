import { act, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';
import { SkeletonCard } from './SkeletonCard';

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SkeletonCard', () => {
  it('announces loading once when given a label', async () => {
    await render(<SkeletonCard width={170} label="Loading stories" />);

    expect(screen.getByRole('progressbar', { name: 'Loading stories' })).toBeOnTheScreen();
  });

  it('is hidden from screen readers without a label so loading is announced only once', async () => {
    await render(<SkeletonCard width={170} />);

    expect(screen.queryByRole('progressbar')).not.toBeOnTheScreen();
  });

  it('uses the same shorter cover as story cards in landscape', async () => {
    const coverHeight = () => StyleSheet.flatten(screen.getByTestId('skeleton-cover').props.style).height;

    const { unmount } = await render(<SkeletonCard width={200} label="Loading" />);
    const portrait = coverHeight();
    await unmount();
    await render(<SkeletonCard width={200} label="Loading" landscape />);
    const landscape = coverHeight();

    expect(landscape).toBeLessThan(portrait);
  });

  it('pulses to show that content is on the way', async () => {
    const loop = jest.spyOn(Animated, 'loop');
    await render(<SkeletonCard width={170} />);

    await waitFor(() => expect(loop).toHaveBeenCalledTimes(1));
  });

  it('stays still when Reduce Motion is on', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const loop = jest.spyOn(Animated, 'loop');
    await render(<SkeletonCard width={170} />);
    await act(async () => {});

    expect(loop).not.toHaveBeenCalled();
  });
});
