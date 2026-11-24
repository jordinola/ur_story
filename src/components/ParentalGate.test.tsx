import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { makeGateQuestion } from '../lib/gateQuestion';
import { ParentalGate } from './ParentalGate';

jest.mock('../lib/gateQuestion', () => ({ makeGateQuestion: jest.fn() }));

const mockMake = makeGateQuestion as jest.MockedFunction<typeof makeGateQuestion>;

const first = { prompt: 'What is 6 × 7?', answer: 42, options: [35, 42, 48, 49] };
const second = { prompt: 'What is 4 × 8?', answer: 32, options: [24, 32, 36, 40] };

async function renderGate() {
  const onPass = jest.fn();
  const onCancel = jest.fn();
  await render(<ParentalGate onPass={onPass} onCancel={onCancel} />);
  return { onPass, onCancel };
}

beforeEach(() => {
  mockMake.mockReset();
  mockMake.mockReturnValueOnce(first).mockReturnValue(second);
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('ParentalGate', () => {
  it('shows the title and the prompt', async () => {
    await renderGate();

    expect(screen.getByText('Grown-ups only')).toBeOnTheScreen();
    expect(screen.getByText('What is 6 × 7?')).toBeOnTheScreen();
  });

  it('renders each option as a labelled button', async () => {
    await renderGate();

    for (const n of first.options) {
      expect(screen.getByRole('button', { name: String(n) })).toBeOnTheScreen();
    }
  });

  it('hideCancel removes the Cancel button', async () => {
    await render(<ParentalGate onPass={jest.fn()} onCancel={jest.fn()} hideCancel />);

    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeOnTheScreen();
  });

  it('calls onPass for the correct answer', async () => {
    const { onPass, onCancel } = await renderGate();

    await fireEvent.press(screen.getByRole('button', { name: '42' }));

    expect(onPass).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('on a wrong answer shows a friendly message, asks a new question and calls nothing', async () => {
    const { onPass, onCancel } = await renderGate();

    await fireEvent.press(screen.getByRole('button', { name: '35' }));

    expect(onPass).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByText('Not quite. Here is a new one!')).toBeOnTheScreen();
    expect(screen.getByText('What is 4 × 8?')).toBeOnTheScreen();
    expect(screen.queryByText('What is 6 × 7?')).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '32' })).toBeOnTheScreen();
  });

  it('announces the retry message and the new question to VoiceOver', async () => {
    await renderGate();

    await fireEvent.press(screen.getByRole('button', { name: '35' }));

    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'Not quite. Here is a new one! What is 4 × 8?',
    );
  });

  it('calls onPass only once even if the correct answer is pressed twice', async () => {
    const { onPass } = await renderGate();

    await fireEvent.press(screen.getByRole('button', { name: '42' }));
    await fireEvent.press(screen.getByRole('button', { name: '42' }));

    expect(onPass).toHaveBeenCalledTimes(1);
  });

  it('scrolls its content, centered, so nothing clips at large text sizes', async () => {
    await renderGate();

    const scroll = screen.getByTestId('parental-gate-scroll');
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle)).toMatchObject({
      flexGrow: 1,
      justifyContent: 'center',
    });
    expect(within(scroll).getByText('Grown-ups only')).toBeOnTheScreen();
    expect(within(scroll).getByRole('button', { name: 'Cancel' })).toBeOnTheScreen();
  });

  it('calls onCancel from Cancel', async () => {
    const { onPass, onCancel } = await renderGate();

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onPass).not.toHaveBeenCalled();
  });

  it('makes every button at least 44pt tall and wide', async () => {
    await renderGate();

    for (const name of ['35', '42', '48', '49', 'Cancel']) {
      const style = StyleSheet.flatten(screen.getByRole('button', { name }).props.style);
      expect(style.minHeight ?? style.height).toBeGreaterThanOrEqual(44);
      expect(style.minWidth ?? style.width ?? 44).toBeGreaterThanOrEqual(44);
    }
  });
});
