import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated } from 'react-native';
import { MarqueeText, MARQUEE_GAP, MARQUEE_PAUSE_MS } from './MarqueeText';

const TITLE = 'Captain Penguin and the Great Ice Cream Rescue';

let reduceMotionListener: ((enabled: boolean) => void) | undefined;
const removeListener = jest.fn();
let timingSpy: jest.SpyInstance;

function mockReduceMotion(enabled: boolean) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(enabled);
}

async function renderMarquee() {
  await render(<MarqueeText>{TITLE}</MarqueeText>);
  // Let the reduce-motion lookup resolve before measuring.
  await act(async () => {});
}

async function measure(containerWidth: number, textWidth: number) {
  await fireEvent(screen.getByTestId('marquee-container'), 'layout', {
    nativeEvent: { layout: { width: containerWidth, height: 20, x: 0, y: 0 } },
  });
  await fireEvent(screen.getByTestId('marquee-track-text', { includeHiddenElements: true }), 'layout', {
    nativeEvent: { layout: { width: textWidth, height: 20, x: 0, y: 0 } },
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  reduceMotionListener = undefined;
  removeListener.mockClear();
  mockReduceMotion(false);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((
    _event: string,
    handler: (enabled: boolean) => void,
  ) => {
    reduceMotionListener = handler;
    return { remove: removeListener };
  }) as unknown as typeof AccessibilityInfo.addEventListener);
  timingSpy = jest.spyOn(Animated, 'timing');
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('MarqueeText', () => {
  it('shows the full text for screen readers', async () => {
    await renderMarquee();

    expect(screen.getByText(TITLE)).toBeOnTheScreen();
  });

  it('does not animate when the text fits', async () => {
    await renderMarquee();
    await measure(300, 200);
    await act(async () => {
      jest.advanceTimersByTime(MARQUEE_PAUSE_MS + 100);
    });

    expect(timingSpy).not.toHaveBeenCalled();
  });

  it('scrolls to the end of the text when it is cut off', async () => {
    await renderMarquee();
    await measure(100, 300);
    await act(async () => {
      jest.advanceTimersByTime(MARQUEE_PAUSE_MS + 100);
    });

    expect(timingSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ toValue: -(300 - 100 + MARQUEE_GAP), useNativeDriver: true }),
    );
  });

  it('does not animate when Reduce Motion is on', async () => {
    mockReduceMotion(true);
    await renderMarquee();
    await measure(100, 300);
    await act(async () => {
      jest.advanceTimersByTime(MARQUEE_PAUSE_MS + 100);
    });

    expect(timingSpy).not.toHaveBeenCalled();
  });

  it('stops the running animation when Reduce Motion is turned on', async () => {
    const stops: jest.SpyInstance[] = [];
    const realLoop = Animated.loop;
    jest.spyOn(Animated, 'loop').mockImplementation((animation, config) => {
      const loop = realLoop(animation, config);
      stops.push(jest.spyOn(loop, 'stop'));
      return loop;
    });
    await renderMarquee();
    await measure(100, 300);
    expect(stops).toHaveLength(1);

    await act(async () => {
      reduceMotionListener?.(true);
    });

    expect(stops[0]).toHaveBeenCalled();
  });

  it('removes the Reduce Motion listener on unmount', async () => {
    const { unmount } = await render(<MarqueeText>{TITLE}</MarqueeText>);

    await unmount();

    expect(removeListener).toHaveBeenCalledTimes(1);
  });
});
