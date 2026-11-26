import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text as MockText } from 'react-native';
import PrivacyLayout from '../app/privacy/_layout';

jest.mock('../lib/gateQuestion', () => ({
  makeGateQuestion: () => ({ prompt: 'What is 6 × 7?', answer: 42, options: [35, 42, 48, 49] }),
}));
jest.mock('../lib/navigation', () => ({ leave: jest.fn() }));
jest.mock('expo-router', () => ({
  Stack: Object.assign(
    function PrivacyStack() {
      return <MockText>privacy stack</MockText>;
    },
    {
      Screen: function Screen() {
        return null;
      },
    },
  ),
}));

describe('privacy route layout', () => {
  it('shows the grown-ups gate and none of the content until it is passed', async () => {
    await render(<PrivacyLayout />);

    expect(screen.getByText('Grown-ups only')).toBeOnTheScreen();
    expect(screen.queryByText('privacy stack')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: '42' }));

    expect(screen.getByText('privacy stack')).toBeOnTheScreen();
  });

  it('asks again on the next visit', async () => {
    const first = await render(<PrivacyLayout />);
    await fireEvent.press(screen.getByRole('button', { name: '42' }));
    await first.unmount();

    await render(<PrivacyLayout />);

    expect(screen.getByText('Grown-ups only')).toBeOnTheScreen();
  });
});
