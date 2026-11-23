import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useWindowDimensions, View, type ModalProps } from 'react-native';
import type { Profile } from '../types';
import { ProfileMenu } from './ProfileMenu';

const mia: Profile = { id: 'a', name: 'Mia', age: 5, tags: [], languages: ['en'], color: '#1D4ED8' };
const leo: Profile = { id: 'b', name: 'Leo', age: 7, tags: [], languages: ['en'], color: '#B91C1C' };

const mockProfiles = {
  ready: true,
  profiles: [mia, leo] as Profile[],
  activeProfile: mia as Profile | null,
  activeId: 'a' as string | null,
  setActive: jest.fn(),
};

jest.mock('../lib/ProfilesProvider', () => ({ useProfiles: () => mockProfiles }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 3, fontScale: 1 })),
}));

beforeEach(() => {
  jest.clearAllMocks();
  (useWindowDimensions as jest.Mock).mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
  mockProfiles.ready = true;
  mockProfiles.profiles = [mia, leo];
  mockProfiles.activeProfile = mia;
  mockProfiles.activeId = 'a';
});

const modalProps: { current: ModalProps | null } = { current: null };

// Stand-in Modal that renders its children only while visible and captures props, so a test can
// simulate iOS finishing the dismissal (onDismiss).
jest.mock('react-native/Libraries/Modal/Modal', () => {
  const Stub = (props: ModalProps) => {
    modalProps.current = props;
    return props.visible ? props.children : null;
  };
  return { __esModule: true, default: Stub };
});

const finishDismiss = async () => {
  await act(async () => {
    modalProps.current?.onDismiss?.();
  });
};

const open = async (label = 'Profile menu for Mia') => {
  await render(<ProfileMenu />);
  await fireEvent.press(screen.getByLabelText(label));
};

describe('ProfileMenu', () => {
  it('labels the button by the active profile', async () => {
    await render(<ProfileMenu />);

    expect(screen.getByLabelText('Profile menu for Mia')).toBeOnTheScreen();
  });

  it('uses a generic label with no active profile', async () => {
    mockProfiles.profiles = [];
    mockProfiles.activeProfile = null;
    mockProfiles.activeId = null;
    await render(<ProfileMenu />);

    expect(screen.getByLabelText('Profiles menu')).toBeOnTheScreen();
  });

  it('opens on press and lists profiles with the active one selected', async () => {
    await open();

    expect(screen.getByRole('button', { name: 'Leo' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mia', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Leo', selected: false })).toBeOnTheScreen();
  });

  it('switches profile and closes when a profile is tapped', async () => {
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Leo' }));

    expect(mockProfiles.setActive).toHaveBeenCalledWith('b');
    expect(screen.queryByText('Manage profiles')).not.toBeOnTheScreen();
  });

  it('closes then opens manage profiles', async () => {
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Manage profiles' }));
    await finishDismiss();

    expect(router.push).toHaveBeenCalledWith('/profiles');
    expect(screen.queryByText('Manage profiles')).not.toBeOnTheScreen();
  });

  it('with no profiles shows only the add entry', async () => {
    mockProfiles.profiles = [];
    mockProfiles.activeProfile = null;
    mockProfiles.activeId = null;
    await open('Profiles menu');

    expect(screen.queryByText('Manage profiles')).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Add a kid profile' }));
    await finishDismiss();
    expect(router.push).toHaveBeenCalledWith('/profiles/edit');
  });

  it('dismisses when the backdrop is pressed', async () => {
    await open();
    await fireEvent.press(screen.getByLabelText('Close menu'));

    expect(screen.queryByText('Manage profiles')).not.toBeOnTheScreen();
  });

  it('shows no profile rows until profiles are ready', async () => {
    mockProfiles.ready = false;
    await open();

    expect(screen.queryByRole('button', { name: 'Leo' })).not.toBeOnTheScreen();
    expect(screen.queryByText('Manage profiles')).not.toBeOnTheScreen();
  });

  it('shows a visible check only on the active profile', async () => {
    await open();

    expect(screen.getAllByTestId('active-check', { includeHiddenElements: true })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Mia' })).toContainElement(
      screen.getByTestId('active-check', { includeHiddenElements: true }),
    );
  });

  it('waits for the modal to finish dismissing before navigating', async () => {
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Manage profiles' }));

    expect(router.push).not.toHaveBeenCalled();

    await finishDismiss();

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/profiles');
  });

  it('does not navigate on dismiss when nothing is pending', async () => {
    await open();
    await fireEvent.press(screen.getByLabelText('Close menu'));
    await finishDismiss();

    expect(router.push).not.toHaveBeenCalled();
  });

  it('clamps the list height to a short landscape window', async () => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 667, height: 375, scale: 3, fontScale: 1 });
    await open();

    // fallback top = 0 inset + 44 header + 8 gap = 52; 375 - 52 - 0 bottom - 12 margin = 311
    expect(screen.getByTestId('profile-menu-list')).toHaveStyle({ maxHeight: 311 });
  });

  it('anchors below the measured trigger, aligned to its right edge', async () => {
    // Host views share one prototype in jest, so stubbing it stubs the trigger's measureInWindow.
    let probe: object | null = null;
    await render(
      <View
        ref={(node) => {
          probe = node;
        }}
      />,
    );
    const hostPrototype = Object.getPrototypeOf(probe);
    const measure = jest
      .spyOn(hostPrototype, 'measureInWindow')
      .mockImplementation((...args: unknown[]) =>
        (args[0] as (x: number, y: number, w: number, h: number) => void)(300, 60, 44, 44),
      );
    await render(<ProfileMenu />);
    await fireEvent.press(screen.getByLabelText('Profile menu for Mia'));
    measure.mockRestore();

    // top = 60 + 44 + 8 gap; right = 390 window width - (300 + 44)
    expect(screen.getByTestId('profile-menu-anchor')).toHaveStyle({ top: 112, right: 46 });
  });
});
