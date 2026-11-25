import { fireEvent, render, screen } from '@testing-library/react-native';
import { makeGateQuestion } from '../lib/gateQuestion';
import { makeStory } from '../test/fixtures';
import type { Story } from '../types';
import { RemoveDownloadGate } from './RemoveDownloadGate';

jest.mock('../lib/gateQuestion', () => ({ makeGateQuestion: jest.fn() }));
jest.mock('../lib/useReduceMotion', () => ({ useReduceMotion: () => true }));

const mockDownloads = {
  pendingRemoval: null as Story | null,
  confirmRemoval: jest.fn(),
  dismissRemoval: jest.fn(),
};
jest.mock('../lib/DownloadsProvider', () => ({ useDownloads: () => mockDownloads }));

const mockBedtime = { locked: false };
jest.mock('../lib/BedtimeProvider', () => ({ useBedtime: () => mockBedtime }));

const mockPlayer = { current: null as Story | null };
jest.mock('../lib/PlayerProvider', () => ({ usePlayer: () => mockPlayer }));

const question = { prompt: 'What is 6 × 7?', answer: 42, options: [35, 42, 48, 49] };

beforeEach(() => {
  jest.clearAllMocks();
  mockDownloads.pendingRemoval = null;
  mockBedtime.locked = false;
  mockPlayer.current = null;
  jest.mocked(makeGateQuestion).mockReturnValue(question);
});

describe('RemoveDownloadGate', () => {
  it('shows nothing without a pending removal', async () => {
    await render(<RemoveDownloadGate />);

    expect(screen.queryByText('Grown-ups only')).not.toBeOnTheScreen();
    expect(screen.toJSON()).toBeNull();
  });

  it('shows the parental gate for the pending story', async () => {
    mockDownloads.pendingRemoval = makeStory({ id: 'moon', title: 'The Sleepy Moon' });

    await render(<RemoveDownloadGate />);

    expect(screen.getByText('Grown-ups only')).toBeOnTheScreen();
    expect(screen.getByText('Remove "The Sleepy Moon" from this device?')).toBeOnTheScreen();
    expect(screen.getByText(question.prompt)).toBeOnTheScreen();
  });

  it('passing the gate confirms removal', async () => {
    mockDownloads.pendingRemoval = makeStory({ id: 'moon', title: 'The Sleepy Moon' });
    await render(<RemoveDownloadGate />);

    await fireEvent.press(screen.getByRole('button', { name: '42' }));

    expect(mockDownloads.confirmRemoval).toHaveBeenCalledTimes(1);
    expect(mockDownloads.dismissRemoval).not.toHaveBeenCalled();
  });

  it('passing the gate dismisses the removal when the story is now playing', async () => {
    const moon = makeStory({ id: 'moon', title: 'The Sleepy Moon' });
    mockDownloads.pendingRemoval = moon;
    mockPlayer.current = moon;
    await render(<RemoveDownloadGate />);

    await fireEvent.press(screen.getByRole('button', { name: '42' }));

    expect(mockDownloads.confirmRemoval).not.toHaveBeenCalled();
    expect(mockDownloads.dismissRemoval).toHaveBeenCalledTimes(1);
  });

  it('passing the gate still removes when another story is playing', async () => {
    mockDownloads.pendingRemoval = makeStory({ id: 'moon', title: 'The Sleepy Moon' });
    mockPlayer.current = makeStory({ id: 'fox', title: 'Brave Fox' });
    await render(<RemoveDownloadGate />);

    await fireEvent.press(screen.getByRole('button', { name: '42' }));

    expect(mockDownloads.confirmRemoval).toHaveBeenCalledTimes(1);
    expect(mockDownloads.dismissRemoval).not.toHaveBeenCalled();
  });

  it('cancelling dismisses it', async () => {
    mockDownloads.pendingRemoval = makeStory({ id: 'moon', title: 'The Sleepy Moon' });
    await render(<RemoveDownloadGate />);

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockDownloads.dismissRemoval).toHaveBeenCalledTimes(1);
    expect(mockDownloads.confirmRemoval).not.toHaveBeenCalled();
  });

  it('steps aside for the bedtime lock and dismisses the removal', async () => {
    mockDownloads.pendingRemoval = makeStory({ id: 'moon', title: 'The Sleepy Moon' });
    const { rerender } = await render(<RemoveDownloadGate />);
    expect(screen.getByText('Grown-ups only')).toBeOnTheScreen();

    mockBedtime.locked = true;
    await rerender(<RemoveDownloadGate />);

    expect(screen.queryByText('Grown-ups only')).not.toBeOnTheScreen();
    expect(mockDownloads.dismissRemoval).toHaveBeenCalledTimes(1);
    expect(mockDownloads.confirmRemoval).not.toHaveBeenCalled();
  });
});
