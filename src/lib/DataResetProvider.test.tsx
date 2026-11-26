import { act, render, renderHook, screen } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Alert, Text } from 'react-native';
import { DataResetProvider, useDataReset } from './DataResetProvider';
import { eraseAllData } from './eraseData';
import { resetToHome } from './navigation';

jest.mock('./eraseData', () => ({ eraseAllData: jest.fn() }));
jest.mock('./navigation', () => ({ resetToHome: jest.fn() }));

const erase = jest.mocked(eraseAllData);
const events: string[] = [];

function Child() {
  useEffect(() => {
    events.push('mount');
    return () => {
      events.push('unmount');
    };
  }, []);
  return <Text>child</Text>;
}

const captured: { api: ReturnType<typeof useDataReset> | null } = { api: null };
function Probe() {
  const api = useDataReset();
  useEffect(() => {
    captured.api = api;
  }, [api]);
  return null;
}

// act() awaits what its callback returns, so the erase promise is awaited in a second act.
const eraseEverything = async () => {
  let done: Promise<void> = Promise.resolve();
  await act(async () => {
    done = captured.api?.eraseEverything() ?? done;
  });
  await act(async () => done);
};

const mountTree = () =>
  render(
    <DataResetProvider>
      <Probe />
      <Child />
    </DataResetProvider>,
  );

beforeEach(() => {
  events.length = 0;
  erase.mockReset();
  erase.mockImplementation(async () => {
    events.push('erase');
  });
  jest.mocked(resetToHome).mockReset();
  jest.mocked(resetToHome).mockImplementation(() => {
    events.push('reset');
  });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {
    events.push('alert');
  });
});

describe('DataResetProvider', () => {
  it('goes home, unmounts the tree, erases, then mounts it fresh', async () => {
    await mountTree();

    await eraseEverything();

    expect(events).toEqual(['mount', 'reset', 'unmount', 'erase', 'mount']);
  });

  it('covers the screen with the app background while it erases', async () => {
    let finish: () => void = () => {};
    erase.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
    await mountTree();

    await act(async () => {
      void captured.api?.eraseEverything();
    });
    expect(screen.getByTestId('data-reset-cover')).toBeOnTheScreen();

    await act(async () => finish());
    expect(screen.queryByTestId('data-reset-cover')).not.toBeOnTheScreen();
  });

  it('ignores a second call while one is running', async () => {
    await mountTree();

    await act(async () => {
      void captured.api?.eraseEverything();
      void captured.api?.eraseEverything();
    });
    await act(async () => {});

    expect(erase).toHaveBeenCalledTimes(1);
  });

  it('brings the tree back, then alerts, when erasing fails', async () => {
    erase.mockRejectedValue(new Error('Could not erase all data'));
    await mountTree();

    await eraseEverything();

    expect(Alert.alert).toHaveBeenCalledWith('Could not erase everything', 'Please try again.');
    expect(events).toEqual(['mount', 'reset', 'unmount', 'mount', 'alert']);
  });

  it('throws when used outside the provider', async () => {
    await expect(renderHook(() => useDataReset())).rejects.toThrow(
      'useDataReset must be used inside DataResetProvider',
    );
  });
});
