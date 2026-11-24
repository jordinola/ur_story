import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { makeGateQuestion } from '../lib/gateQuestion';
import { BedtimeLock } from './BedtimeLock';

jest.mock('expo-router', () => ({ router: { dismissAll: jest.fn(), canDismiss: jest.fn(() => true) } }));
jest.mock('../lib/gateQuestion', () => ({ makeGateQuestion: jest.fn() }));

const mockBedtime = { ready: true, locked: false, endBedtime: jest.fn() };
jest.mock('../lib/BedtimeProvider', () => ({ useBedtime: () => mockBedtime }));

const question = { prompt: 'What is 6 × 7?', answer: 42, options: [35, 42, 48, 49] };

beforeEach(() => {
  jest.clearAllMocks();
  mockBedtime.ready = true;
  mockBedtime.locked = false;
  jest.mocked(makeGateQuestion).mockReturnValue(question);
  jest.mocked(router.canDismiss).mockReturnValue(true);
});

describe('BedtimeLock', () => {
  it('covers the app until the saved session has loaded', async () => {
    mockBedtime.ready = false;
    await render(<BedtimeLock />);

    expect(screen.getByTestId('bedtime-loading')).toBeOnTheScreen();
    expect(screen.queryByText('Grown-ups only')).not.toBeOnTheScreen();
  });

  it('renders nothing when not locked', async () => {
    await render(<BedtimeLock />);

    expect(screen.queryByText('Grown-ups only')).not.toBeOnTheScreen();
  });

  it('shows the grown-ups gate when locked and has no Cancel button', async () => {
    mockBedtime.locked = true;
    await render(<BedtimeLock />);

    expect(screen.getByText('Grown-ups only')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeOnTheScreen();
  });

  it('keeps it locked after a wrong answer', async () => {
    mockBedtime.locked = true;
    await render(<BedtimeLock />);

    await fireEvent.press(screen.getByRole('button', { name: '35' }));

    expect(mockBedtime.endBedtime).not.toHaveBeenCalled();
    expect(screen.getByText('Grown-ups only')).toBeOnTheScreen();
  });

  it('ends the session on the right answer', async () => {
    mockBedtime.locked = true;
    await render(<BedtimeLock />);

    await fireEvent.press(screen.getByRole('button', { name: '42' }));

    expect(mockBedtime.endBedtime).toHaveBeenCalledTimes(1);
  });

  it('dismisses presented modal routes when it becomes locked', async () => {
    const { rerender } = await render(<BedtimeLock />);
    expect(router.dismissAll).not.toHaveBeenCalled();

    mockBedtime.locked = true;
    await rerender(<BedtimeLock />);

    expect(router.dismissAll).toHaveBeenCalledTimes(1);
  });

  it('does not dismiss when there is nothing to dismiss', async () => {
    jest.mocked(router.canDismiss).mockReturnValue(false);
    mockBedtime.locked = true;

    await render(<BedtimeLock />);

    expect(router.dismissAll).not.toHaveBeenCalled();
  });
});
