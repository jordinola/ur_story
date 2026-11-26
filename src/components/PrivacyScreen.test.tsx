import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { PRIVACY_SUMMARY } from '../data/privacyPolicy';
import { PrivacyScreen } from './PrivacyScreen';

const mockReset = { eraseEverything: jest.fn(() => Promise.resolve()) };
jest.mock('../lib/DataResetProvider', () => ({ useDataReset: () => mockReset }));

beforeEach(() => {
  mockReset.eraseEverything.mockClear();
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('PrivacyScreen', () => {
  it('shows the at-a-glance summary', async () => {
    await render(<PrivacyScreen />);

    expect(screen.getByRole('header', { name: 'At a glance' })).toBeOnTheScreen();
    for (const line of PRIVACY_SUMMARY) expect(screen.getByText(line)).toBeOnTheScreen();
  });

  it('shows the policy as headings and text, with the contact email', async () => {
    await render(<PrivacyScreen />);

    expect(screen.getByRole('header', { name: 'Who we are' })).toBeOnTheScreen();
    expect(screen.getByText(/Cloudflare can see the device's IP address/)).toBeOnTheScreen();
    expect(screen.getAllByText(/jjob3011@gmail\.com/).length).toBeGreaterThan(0);
  });

  it('asks for confirmation before erasing and does not erase yet', async () => {
    await render(<PrivacyScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Delete all data' }));

    expect(screen.getByRole('button', { name: 'Delete everything' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Keep my data' })).toBeOnTheScreen();
    expect(mockReset.eraseEverything).not.toHaveBeenCalled();
  });

  it('goes back to the normal view when the parent keeps the data', async () => {
    await render(<PrivacyScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete all data' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Keep my data' }));

    expect(screen.getByRole('button', { name: 'Delete all data' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Delete everything' })).not.toBeOnTheScreen();
    expect(mockReset.eraseEverything).not.toHaveBeenCalled();
  });

  it('erases once even when Delete everything is pressed twice', async () => {
    await render(<PrivacyScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete all data' }));

    const confirm = screen.getByRole('button', { name: 'Delete everything' });
    await fireEvent.press(confirm);
    await fireEvent.press(confirm);

    expect(mockReset.eraseEverything).toHaveBeenCalledTimes(1);
  });

  it('shows the contact email as selectable text', async () => {
    await render(<PrivacyScreen />);

    expect(screen.getByText('jjob3011@gmail.com').props.selectable).toBe(true);
  });

  it('announces the confirmation and warns on the delete button that it cannot be undone', async () => {
    await render(<PrivacyScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Delete all data' }));

    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'Are you sure? Delete everything cannot be undone.',
    );
    expect(screen.getByRole('button', { name: 'Delete everything' }).props.accessibilityHint).toBe(
      'This cannot be undone',
    );
  });
});
