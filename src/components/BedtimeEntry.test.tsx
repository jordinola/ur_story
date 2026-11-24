import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { BEDTIME_TIP_KEY } from '../lib/bedtime';
import { makeGateQuestion } from '../lib/gateQuestion';
import { BedtimeEntry } from './BedtimeEntry';

jest.mock('../lib/gateQuestion', () => ({ makeGateQuestion: jest.fn() }));
jest.mock('../lib/useReduceMotion', () => ({ useReduceMotion: () => true }));

const mockBedtime = {
  active: false,
  locked: false,
  remainingSec: null as number | null,
  startBedtime: jest.fn(),
  endBedtime: jest.fn(),
};
jest.mock('../lib/BedtimeProvider', () => ({ useBedtime: () => mockBedtime }));

const question = { prompt: 'What is 6 × 7?', answer: 42, options: [35, 42, 48, 49] };

const openAndPassGate = async () => {
  await fireEvent.press(screen.getByRole('button', { name: /^Bedtime/ }));
  await fireEvent.press(screen.getByRole('button', { name: '42' }));
};

beforeEach(async () => {
  jest.clearAllMocks();
  mockBedtime.active = false;
  mockBedtime.locked = false;
  mockBedtime.remainingSec = null;
  jest.mocked(makeGateQuestion).mockReturnValue(question);
  await AsyncStorage.clear();
});

describe('BedtimeEntry', () => {
  it('closes its gate when the app locks, so the lock is not hidden', async () => {
    const { rerender } = await render(<BedtimeEntry />);
    await fireEvent.press(screen.getByRole('button', { name: 'Bedtime' }));
    expect(screen.getByText('Grown-ups only')).toBeOnTheScreen();

    mockBedtime.locked = true;
    await rerender(<BedtimeEntry />);

    expect(screen.queryByText('Grown-ups only')).not.toBeOnTheScreen();
  });

  it('closes the End bedtime sheet when the app locks', async () => {
    mockBedtime.active = true;
    mockBedtime.remainingSec = 5;
    const { rerender } = await render(<BedtimeEntry />);
    await openAndPassGate();
    expect(screen.getByRole('button', { name: 'End bedtime' })).toBeOnTheScreen();

    mockBedtime.locked = true;
    await rerender(<BedtimeEntry />);

    expect(screen.queryByRole('button', { name: 'End bedtime' })).not.toBeOnTheScreen();
  });

  it('shows "Bedtime" when no session is running', async () => {
    await render(<BedtimeEntry />);

    expect(screen.getByRole('button', { name: 'Bedtime' })).toBeOnTheScreen();
  });

  it('shows the time left while a session is running', async () => {
    mockBedtime.active = true;
    mockBedtime.remainingSec = 754;
    await render(<BedtimeEntry />);

    expect(screen.getByText('Bedtime · 12:34')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Bedtime, 12 minutes 34 seconds left' })).toBeOnTheScreen();
  });

  it('asks the grown-ups gate before showing any duration', async () => {
    await render(<BedtimeEntry />);

    await fireEvent.press(screen.getByRole('button', { name: 'Bedtime' }));

    expect(screen.getByText('Grown-ups only')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: '15 minutes' })).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: '42' }));

    for (const label of ['15 minutes', '30 minutes', '45 minutes']) {
      expect(screen.getByRole('button', { name: label })).toBeOnTheScreen();
    }
  });

  it('closes without starting when the gate is cancelled', async () => {
    await render(<BedtimeEntry />);
    await fireEvent.press(screen.getByRole('button', { name: 'Bedtime' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Grown-ups only')).not.toBeOnTheScreen();
    expect(mockBedtime.startBedtime).not.toHaveBeenCalled();
  });

  it('picking 30 minutes starts a 30 minute session', async () => {
    await render(<BedtimeEntry />);
    await openAndPassGate();

    await fireEvent.press(screen.getByRole('button', { name: '30 minutes' }));

    expect(mockBedtime.startBedtime).toHaveBeenCalledWith(30);
  });

  it('shows the Guided Access tip the first time only', async () => {
    await render(<BedtimeEntry />);
    await openAndPassGate();
    await fireEvent.press(screen.getByRole('button', { name: '15 minutes' }));

    expect(await screen.findByText(/Guided Access/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Got it' }));
    await waitFor(() => expect(screen.queryByText(/Guided Access/)).not.toBeOnTheScreen());
    expect(await AsyncStorage.getItem(BEDTIME_TIP_KEY)).not.toBeNull();

    await openAndPassGate();
    await fireEvent.press(screen.getByRole('button', { name: '15 minutes' }));

    await waitFor(() => expect(mockBedtime.startBedtime).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/Guided Access/)).not.toBeOnTheScreen();
  });

  it('offers End bedtime for a running session', async () => {
    mockBedtime.active = true;
    mockBedtime.remainingSec = 300;
    await render(<BedtimeEntry />);
    await openAndPassGate();

    expect(screen.queryByRole('button', { name: '15 minutes' })).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'End bedtime' }));

    expect(mockBedtime.endBedtime).toHaveBeenCalledTimes(1);
  });
});
