import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { MoreSheet } from './MoreSheet';

const mockPlayer = {
  playbackRate: 1,
  setPlaybackRate: jest.fn(),
  sleepMinutes: null as number | null,
  sleepRemainingSec: null as number | null,
  setSleepTimer: jest.fn(),
};

const mockBedtime = {
  active: false,
  locked: false,
  remainingSec: null as number | null,
};

jest.mock('../lib/PlayerProvider', () => ({ usePlayer: () => mockPlayer }));
jest.mock('../lib/BedtimeProvider', () => ({ useBedtime: () => mockBedtime }));

beforeEach(() => {
  jest.clearAllMocks();
  mockPlayer.playbackRate = 1;
  mockPlayer.sleepMinutes = null;
  mockPlayer.sleepRemainingSec = null;
  mockBedtime.active = false;
  mockBedtime.locked = false;
  mockBedtime.remainingSec = null;
});

describe('MoreSheet', () => {
  it('keeps Close outside a scroll area that holds the rows', async () => {
    await render(<MoreSheet visible onClose={jest.fn()} />);

    const scroll = screen.getByTestId('more-sheet-rows');
    expect(screen.getByRole('button', { name: 'Close' })).toBeOnTheScreen();
    expect(within(scroll).getByText('Speed')).toBeOnTheScreen();
    expect(within(scroll).getByText('Sleep timer')).toBeOnTheScreen();
    expect(within(scroll).queryByRole('button', { name: 'Close' })).toBeNull();
  });

  it('shows speed chips with the current rate selected', async () => {
    mockPlayer.playbackRate = 1.25;
    await render(<MoreSheet visible onClose={jest.fn()} />);

    expect(screen.getByRole('button', { name: '1.25x speed', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '1x speed', selected: false })).toBeOnTheScreen();
  });

  it('choosing a speed calls setPlaybackRate', async () => {
    await render(<MoreSheet visible onClose={jest.fn()} />);

    await fireEvent.press(screen.getByRole('button', { name: '1.25x speed' }));

    expect(mockPlayer.setPlaybackRate).toHaveBeenCalledWith(1.25);
  });

  it('shows sleep chips and toggles the timer', async () => {
    mockPlayer.sleepMinutes = 20;
    await render(<MoreSheet visible onClose={jest.fn()} />);

    expect(screen.getByText('Sleep timer')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('10m'));
    expect(mockPlayer.setSleepTimer).toHaveBeenLastCalledWith(10);
    await fireEvent.press(screen.getByText('20m'));
    expect(mockPlayer.setSleepTimer).toHaveBeenLastCalledWith(null);
  });

  it('shows the remaining sleep time while a timer runs', async () => {
    mockPlayer.sleepMinutes = 10;
    mockPlayer.sleepRemainingSec = 125;
    await render(<MoreSheet visible onClose={jest.fn()} />);

    expect(screen.getByText('Sleep in 2:05')).toBeOnTheScreen();
  });

  it('during a bedtime session shows Bedtime ends in and no sleep chips', async () => {
    mockBedtime.active = true;
    mockBedtime.remainingSec = 600;
    await render(<MoreSheet visible onClose={jest.fn()} />);

    expect(screen.getByText('Bedtime ends in 10:00')).toBeOnTheScreen();
    expect(screen.queryByText('10m')).not.toBeOnTheScreen();
    expect(screen.queryByText('20m')).not.toBeOnTheScreen();
    expect(screen.queryByText('30m')).not.toBeOnTheScreen();
  });

  it('closes when the bedtime lock appears', async () => {
    const onClose = jest.fn();
    const view = await render(<MoreSheet visible onClose={onClose} />);
    expect(onClose).not.toHaveBeenCalled();

    mockBedtime.locked = true;
    await view.rerender(<MoreSheet visible onClose={onClose} />);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when hidden while locked', async () => {
    mockBedtime.locked = true;
    const onClose = jest.fn();
    await render(<MoreSheet visible={false} onClose={onClose} />);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when opened while already locked', async () => {
    mockBedtime.locked = true;
    const onClose = jest.fn();
    const view = await render(<MoreSheet visible={false} onClose={onClose} />);

    await view.rerender(<MoreSheet visible onClose={onClose} />);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('close button and backdrop call onClose', async () => {
    const onClose = jest.fn();
    await render(<MoreSheet visible onClose={onClose} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    await fireEvent.press(screen.getByTestId('more-sheet-backdrop'));

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renders nothing visible when visible is false', async () => {
    await render(<MoreSheet visible={false} onClose={jest.fn()} />);

    expect(screen.queryByText('Speed')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });
});
