import { fireEvent, render, screen } from '@testing-library/react-native';
import { makeStory } from '../test/fixtures';
import { UpNextList } from './UpNextList';

const first = makeStory({ id: 'a', title: 'Brave Bear', durationSec: 300 });
const second = makeStory({ id: 'b', title: 'Sleepy Fox', durationSec: 600 });

const mockQueue = {
  queue: [] as ReturnType<typeof makeStory>[],
  moveToTop: jest.fn(),
  remove: jest.fn(),
};

jest.mock('../lib/QueueProvider', () => ({ useQueue: () => mockQueue }));

beforeEach(() => {
  jest.clearAllMocks();
  mockQueue.queue = [];
});

describe('UpNextList', () => {
  it('shows the empty state', async () => {
    await render(<UpNextList />);

    expect(screen.getByRole('header', { name: 'Up next' })).toBeOnTheScreen();
    expect(screen.getByText('Nothing queued. Press and hold a story to add it.')).toBeOnTheScreen();
  });

  it('lists queued stories in order', async () => {
    mockQueue.queue = [first, second];
    await render(<UpNextList />);

    expect(screen.getByText('Brave Bear')).toBeOnTheScreen();
    expect(screen.getByText('5 min')).toBeOnTheScreen();
    expect(screen.getByText('10 min')).toBeOnTheScreen();
    expect(screen.queryByText(/Nothing queued/)).not.toBeOnTheScreen();
    const titles = screen.getAllByText(/Brave Bear|Sleepy Fox/).map((n) => n.props.children);
    expect(titles).toEqual(['Brave Bear', 'Sleepy Fox']);
  });

  it('Move to top calls moveToTop with the id', async () => {
    mockQueue.queue = [first, second];
    await render(<UpNextList />);

    await fireEvent.press(screen.getByRole('button', { name: 'Move Sleepy Fox to top' }));

    expect(mockQueue.moveToTop).toHaveBeenCalledWith('b');
  });

  it('Remove calls remove with the id', async () => {
    mockQueue.queue = [first, second];
    await render(<UpNextList />);

    await fireEvent.press(screen.getByRole('button', { name: 'Remove Brave Bear from queue' }));

    expect(mockQueue.remove).toHaveBeenCalledWith('a');
  });

  it('first row has no Move to top button', async () => {
    mockQueue.queue = [first, second];
    await render(<UpNextList />);

    expect(screen.queryByRole('button', { name: 'Move Brave Bear to top' })).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Move Sleepy Fox to top' })).toBeOnTheScreen();
  });

  it('buttons have accessibility labels and roles', async () => {
    mockQueue.queue = [first, second];
    await render(<UpNextList />);

    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.getByLabelText('Remove Sleepy Fox from queue')).toBeOnTheScreen();
  });
});
