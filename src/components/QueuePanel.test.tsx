import { fireEvent, render, screen } from '@testing-library/react-native';
import { makeStory } from '../test/fixtures';
import { QueuePanel } from './QueuePanel';

const first = makeStory({ id: 'a', title: 'Brave Bear', durationSec: 300 });
const second = makeStory({ id: 'b', title: 'Sleepy Fox', durationSec: 600 });

const mockQueue = {
  queue: [] as ReturnType<typeof makeStory>[],
  moveToTop: jest.fn(),
  remove: jest.fn(),
  playNow: jest.fn(),
};

jest.mock('../lib/QueueProvider', () => ({ useQueue: () => mockQueue }));

beforeEach(() => {
  jest.clearAllMocks();
  mockQueue.queue = [];
});

describe('QueuePanel', () => {
  it('shows the empty state', async () => {
    await render(<QueuePanel />);

    expect(screen.getByRole('header', { name: 'Up next' })).toBeOnTheScreen();
    expect(screen.getByText('Your queue is empty')).toBeOnTheScreen();
    expect(screen.getByText('Press and hold a story, or tap ⋯ on a card, to add it.')).toBeOnTheScreen();
    expect(screen.queryByText(/Nothing queued/)).not.toBeOnTheScreen();
  });

  it('shows a large fixed-size glyph in the empty state', async () => {
    await render(<QueuePanel />);

    expect(screen.getByText('☰', { includeHiddenElements: true }).props.allowFontScaling).toBe(false);
  });

  it('hides the decorative glyph from VoiceOver', async () => {
    await render(<QueuePanel />);

    const glyph = screen.getByText('☰', { includeHiddenElements: true });
    expect(glyph.props.accessibilityElementsHidden).toBe(true);
    expect(glyph.props.importantForAccessibility).toBe('no');
  });

  it('lists queued stories in order', async () => {
    mockQueue.queue = [first, second];
    await render(<QueuePanel />);

    expect(screen.getByText('Brave Bear')).toBeOnTheScreen();
    expect(screen.getByText('5 min')).toBeOnTheScreen();
    expect(screen.getByText('10 min')).toBeOnTheScreen();
    expect(screen.queryByText('Your queue is empty')).not.toBeOnTheScreen();
    const titles = screen.getAllByText(/Brave Bear|Sleepy Fox/).map((n) => n.props.children);
    expect(titles).toEqual(['Brave Bear', 'Sleepy Fox']);
  });

  it('Move button calls moveToTop with the id', async () => {
    mockQueue.queue = [first, second];
    await render(<QueuePanel />);

    await fireEvent.press(screen.getByRole('button', { name: 'Move Sleepy Fox to top' }));

    expect(mockQueue.moveToTop).toHaveBeenCalledWith('b');
  });

  it('Remove calls remove with the id', async () => {
    mockQueue.queue = [first, second];
    await render(<QueuePanel />);

    await fireEvent.press(screen.getByRole('button', { name: 'Remove Brave Bear from queue' }));

    expect(mockQueue.remove).toHaveBeenCalledWith('a');
  });

  it('first row has no move button', async () => {
    mockQueue.queue = [first, second];
    await render(<QueuePanel />);

    expect(screen.queryByRole('button', { name: 'Move Brave Bear to top' })).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Move Sleepy Fox to top' })).toBeOnTheScreen();
  });

  it('buttons have accessibility labels and roles', async () => {
    mockQueue.queue = [first, second];
    await render(<QueuePanel />);

    expect(screen.getAllByRole('button')).toHaveLength(5);
    expect(screen.getByLabelText('Move Sleepy Fox to top')).toBeOnTheScreen();
    expect(screen.getByLabelText('Remove Sleepy Fox from queue')).toBeOnTheScreen();
  });

  it('row buttons show no text labels', async () => {
    mockQueue.queue = [first, second];
    await render(<QueuePanel />);

    expect(screen.queryByText('Move to top')).not.toBeOnTheScreen();
    expect(screen.queryByText('Remove')).not.toBeOnTheScreen();
    expect(screen.getByText('⤒')).toBeOnTheScreen();
    expect(screen.getAllByText('✕')).toHaveLength(2);
  });

  it('renders the emoji fallback in each row cover', async () => {
    mockQueue.queue = [first, makeStory({ id: 'b', title: 'Sleepy Fox', emoji: '🦊' })];
    await render(<QueuePanel />);

    expect(screen.getByText('🌙')).toBeOnTheScreen();
    expect(screen.getByText('🦊')).toBeOnTheScreen();
  });

  it('tapping a row plays that story', async () => {
    mockQueue.queue = [first, second];
    await render(<QueuePanel />);

    await fireEvent.press(screen.getByText('Sleepy Fox'));

    expect(mockQueue.playNow).toHaveBeenCalledWith('b');
  });

  it('row play control has the label Play <title> and role button', async () => {
    mockQueue.queue = [first, second];
    await render(<QueuePanel />);

    expect(screen.getByRole('button', { name: 'Play Brave Bear' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Play Sleepy Fox')).toBeOnTheScreen();
  });

  it('Move to top and Remove do not trigger playNow', async () => {
    mockQueue.queue = [first, second];
    await render(<QueuePanel />);

    await fireEvent.press(screen.getByRole('button', { name: 'Move Sleepy Fox to top' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Remove Sleepy Fox from queue' }));

    expect(mockQueue.playNow).not.toHaveBeenCalled();
  });
});
