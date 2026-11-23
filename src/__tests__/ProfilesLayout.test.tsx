import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import ProfilesLayout from '../app/profiles/_layout';

type MockStackProps = { children?: ReactNode };
type MockScreenProps = { options?: { headerRight?: () => ReactNode } };

const mockProfiles = { ready: true };

jest.mock('../lib/ProfilesProvider', () => ({ useProfiles: () => mockProfiles }));
jest.mock('expo-router', () => {
  const { View: RNView } = jest.requireActual('react-native');
  const Stack = Object.assign(
    function Stack({ children }: MockStackProps) {
      return <RNView testID="profiles-stack">{children}</RNView>;
    },
    { Screen: function Screen({ options }: MockScreenProps) { return options?.headerRight?.() ?? null; } },
  );
  return { router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) }, Stack };
});
jest.mock('../components/ParentalGate', () => {
  const { Pressable, Text, View } = jest.requireActual('react-native');
  return {
    ParentalGate: ({ onPass, onCancel }: { onPass: () => void; onCancel: () => void }) => (
      <View testID="gate">
        <Pressable accessibilityRole="button" accessibilityLabel="pass" onPress={onPass}>
          <Text>pass</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="cancel" onPress={onCancel}>
          <Text>cancel</Text>
        </Pressable>
      </View>
    ),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(router.canGoBack).mockReturnValue(true);
  mockProfiles.ready = true;
});

describe('ProfilesLayout', () => {
  it('shows the gate first and the stack only after passing', async () => {
    await render(<ProfilesLayout />);
    expect(screen.getByTestId('gate')).toBeOnTheScreen();
    expect(screen.queryByTestId('profiles-stack')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'pass' }));
    expect(screen.queryByTestId('gate')).toBeNull();
    expect(screen.getByTestId('profiles-stack')).toBeOnTheScreen();
  });

  it('goes back on cancel', async () => {
    await render(<ProfilesLayout />);
    await fireEvent.press(screen.getByRole('button', { name: 'cancel' }));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('leaves to home on cancel when opened cold from a deep link', async () => {
    jest.mocked(router.canGoBack).mockReturnValue(false);
    await render(<ProfilesLayout />);
    await fireEvent.press(screen.getByRole('button', { name: 'cancel' }));
    expect(router.replace).toHaveBeenCalledWith('/');
    expect(router.back).not.toHaveBeenCalled();
  });

  it('closes the modal from Done', async () => {
    await render(<ProfilesLayout />);
    await fireEvent.press(screen.getByRole('button', { name: 'pass' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('leaves to home from Done when opened cold from a deep link', async () => {
    jest.mocked(router.canGoBack).mockReturnValue(false);
    await render(<ProfilesLayout />);
    await fireEvent.press(screen.getByRole('button', { name: 'pass' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(router.replace).toHaveBeenCalledWith('/');
    expect(router.back).not.toHaveBeenCalled();
  });

  it('re-arms the gate after unmount and remount', async () => {
    const first = await render(<ProfilesLayout />);
    await fireEvent.press(screen.getByRole('button', { name: 'pass' }));
    await first.unmount();
    await render(<ProfilesLayout />);
    expect(screen.getByTestId('gate')).toBeOnTheScreen();
  });

  it('waits for profiles to load after the gate before showing the stack', async () => {
    mockProfiles.ready = false;
    const view = await render(<ProfilesLayout />);
    await fireEvent.press(screen.getByRole('button', { name: 'pass' }));
    expect(screen.queryByTestId('profiles-stack')).toBeNull();
    mockProfiles.ready = true;
    await act(async () => view.rerender(<ProfilesLayout />));
    expect(screen.getByTestId('profiles-stack')).toBeOnTheScreen();
  });
});
