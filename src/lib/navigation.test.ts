import { router } from 'expo-router';
import { leave, resetToHome } from './navigation';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true), dismissAll: jest.fn() },
}));

beforeEach(() => jest.clearAllMocks());

describe('leave', () => {
  it('goes back when there is a screen to go back to', () => {
    leave();

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('replaces with home when opened cold from a deep link with nothing behind it', () => {
    jest.mocked(router.canGoBack).mockReturnValueOnce(false);

    leave();

    expect(router.replace).toHaveBeenCalledWith('/');
    expect(router.back).not.toHaveBeenCalled();
  });
});

describe('resetToHome', () => {
  it('dismisses every open screen so home is the only route', () => {
    resetToHome();

    expect(router.dismissAll).toHaveBeenCalledTimes(1);
  });
});
