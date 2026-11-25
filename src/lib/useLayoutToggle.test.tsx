import { act, renderHook } from '@testing-library/react-native';
import { LayoutAnimation } from 'react-native';
import { useLayoutToggle } from './useLayoutToggle';

let mockReduceMotion: boolean | undefined = false;
jest.mock('./useReduceMotion', () => ({ useReduceMotion: () => mockReduceMotion }));

beforeEach(() => {
  jest.spyOn(LayoutAnimation, 'configureNext').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useLayoutToggle', () => {
  it('starts closed and flips on toggle', async () => {
    mockReduceMotion = false;
    const { result } = await renderHook(() => useLayoutToggle());
    expect(result.current[0]).toBe(false);

    await act(() => result.current[1]());
    expect(result.current[0]).toBe(true);

    await act(() => result.current[1]());
    expect(result.current[0]).toBe(false);
  });

  it('animates the next layout when motion is allowed', async () => {
    mockReduceMotion = false;
    const { result } = await renderHook(() => useLayoutToggle());

    await act(() => result.current[1]());

    expect(LayoutAnimation.configureNext).toHaveBeenCalledWith(LayoutAnimation.Presets.easeInEaseOut);
  });

  it.each([true, undefined])('changes instantly when reduce motion is %s', async (value) => {
    mockReduceMotion = value;
    const { result } = await renderHook(() => useLayoutToggle());

    await act(() => result.current[1]());

    expect(result.current[0]).toBe(true);
    expect(LayoutAnimation.configureNext).not.toHaveBeenCalled();
  });
});
