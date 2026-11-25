import { fireEvent, render, screen } from '@testing-library/react-native';
import { makeStory } from '../test/fixtures';
import { UpNextBanner } from './UpNextBanner';

const mockQueue = {
  upNext: null as ReturnType<typeof makeStory> | null,
  gapRemainingSec: null as number | null,
  cancelUpNext: jest.fn(),
};

jest.mock('../lib/QueueProvider', () => ({ useQueue: () => mockQueue }));

beforeEach(() => {
  jest.clearAllMocks();
  mockQueue.upNext = null;
  mockQueue.gapRemainingSec = null;
});

describe('UpNextBanner', () => {
  it('renders nothing when nothing is up next', async () => {
    await render(<UpNextBanner />);

    expect(screen.queryByText(/Up next/)).not.toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('shows the title and seconds remaining', async () => {
    mockQueue.upNext = makeStory();
    mockQueue.gapRemainingSec = 4;
    await render(<UpNextBanner />);

    expect(screen.getByText('Up next: The Sleepy Moon in 4')).toBeOnTheScreen();
  });

  it('Cancel calls cancelUpNext', async () => {
    mockQueue.upNext = makeStory();
    mockQueue.gapRemainingSec = 4;
    await render(<UpNextBanner />);

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel up next' }));

    expect(mockQueue.cancelUpNext).toHaveBeenCalledTimes(1);
  });

  it('exposes the cancel button with a label and role', async () => {
    mockQueue.upNext = makeStory();
    mockQueue.gapRemainingSec = 2;
    await render(<UpNextBanner />);

    expect(screen.getByRole('button', { name: 'Cancel up next' })).toBeOnTheScreen();
    expect(screen.getByText('Cancel')).toBeOnTheScreen();
  });
});
