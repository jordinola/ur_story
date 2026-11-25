import { ActionSheetIOS, Alert, Platform } from 'react-native';
import { makeStory } from '../test/fixtures';
import { showStoryActions } from './storyActions';

const story = makeStory({ title: 'The Sleepy Moon' });

function setup() {
  const handlers = { onPlayNext: jest.fn(), onAddToQueue: jest.fn() };
  return handlers;
}

describe('showStoryActions on iOS', () => {
  beforeEach(() => {
    Platform.OS = 'ios';
  });

  it('shows Play next, Add to queue and Cancel', () => {
    const spy = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => {});

    showStoryActions(story, setup());

    expect(spy).toHaveBeenCalledWith(
      { title: 'The Sleepy Moon', options: ['Play next', 'Add to queue', 'Cancel'], cancelButtonIndex: 2 },
      expect.any(Function),
    );
  });

  it('choosing Add to queue calls onAddToQueue', () => {
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((_o, cb) => cb(1));
    const handlers = setup();

    showStoryActions(story, handlers);

    expect(handlers.onAddToQueue).toHaveBeenCalledTimes(1);
    expect(handlers.onPlayNext).not.toHaveBeenCalled();
  });

  it('choosing Play next calls onPlayNext', () => {
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((_o, cb) => cb(0));
    const handlers = setup();

    showStoryActions(story, handlers);

    expect(handlers.onPlayNext).toHaveBeenCalledTimes(1);
  });

  it('choosing Cancel calls nothing', () => {
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((_o, cb) => cb(2));
    const handlers = setup();

    showStoryActions(story, handlers);

    expect(handlers.onPlayNext).not.toHaveBeenCalled();
    expect(handlers.onAddToQueue).not.toHaveBeenCalled();
  });
});

describe('story actions download entry', () => {
  beforeEach(() => {
    Platform.OS = 'ios';
  });

  const optionsShown = (handlers: Parameters<typeof showStoryActions>[1]) => {
    const spy = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => {});
    showStoryActions(story, handlers);
    return spy.mock.lastCall?.[0];
  };

  it('story actions show Download for a story that is not downloaded', () => {
    const options = optionsShown({ ...setup(), download: { label: 'Download', onPress: jest.fn() } });

    expect(options).toEqual({
      title: 'The Sleepy Moon',
      options: ['Play next', 'Add to queue', 'Download', 'Cancel'],
      cancelButtonIndex: 3,
    });
  });

  it('story actions show Cancel download while downloading', () => {
    const options = optionsShown({ ...setup(), download: { label: 'Cancel download', onPress: jest.fn() } });

    expect(options?.options).toEqual(['Play next', 'Add to queue', 'Cancel download', 'Cancel']);
    expect(options?.cancelButtonIndex).toBe(3);
  });

  it('story actions show Remove download for a downloaded story that is not playing', () => {
    const options = optionsShown({ ...setup(), download: { label: 'Remove download', onPress: jest.fn() } });

    expect(options).toEqual({
      title: 'The Sleepy Moon',
      options: ['Play next', 'Add to queue', 'Remove download', 'Cancel'],
      cancelButtonIndex: 3,
      destructiveButtonIndex: 2,
    });
  });

  it('story actions show no remove entry for the playing story', () => {
    const options = optionsShown(setup());

    expect(options?.options).toEqual(['Play next', 'Add to queue', 'Cancel']);
    expect(options?.cancelButtonIndex).toBe(2);
  });

  it('choosing the download entry calls its handler', () => {
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((_o, cb) => cb(2));
    const handlers = { ...setup(), download: { label: 'Download' as const, onPress: jest.fn() } };

    showStoryActions(story, handlers);

    expect(handlers.download.onPress).toHaveBeenCalledTimes(1);
    expect(handlers.onPlayNext).not.toHaveBeenCalled();
    expect(handlers.onAddToQueue).not.toHaveBeenCalled();
  });

  it('choosing Cancel with a download entry calls nothing', () => {
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((_o, cb) => cb(3));
    const handlers = { ...setup(), download: { label: 'Download' as const, onPress: jest.fn() } };

    showStoryActions(story, handlers);

    expect(handlers.download.onPress).not.toHaveBeenCalled();
  });
});

describe('showStoryActions elsewhere', () => {
  beforeEach(() => {
    Platform.OS = 'android';
  });
  afterEach(() => {
    Platform.OS = 'ios';
  });

  it('uses an Alert with the same choices', () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const handlers = setup();

    showStoryActions(story, handlers);

    const buttons = spy.mock.calls[0]?.[2] ?? [];
    expect(spy.mock.calls[0]?.[0]).toBe('The Sleepy Moon');
    expect(buttons.map((b) => b.text)).toEqual(['Play next', 'Add to queue', 'Cancel']);
    buttons[1]?.onPress?.();
    expect(handlers.onAddToQueue).toHaveBeenCalledTimes(1);
  });

  it('lists the download entry in place of Cancel so Android keeps every choice', () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const handlers = { ...setup(), download: { label: 'Cancel download' as const, onPress: jest.fn() } };

    showStoryActions(story, handlers);

    const buttons = spy.mock.lastCall?.[2] ?? [];
    // Android's Alert keeps only the first three buttons.
    expect(buttons.length).toBeLessThanOrEqual(3);
    expect(buttons.map((b) => b.text)).toEqual(['Play next', 'Add to queue', 'Cancel download']);
    buttons[2]?.onPress?.();
    expect(handlers.download.onPress).toHaveBeenCalledTimes(1);
  });

  it('lets back or a tap outside dismiss the Alert', () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    showStoryActions(story, { ...setup(), download: { label: 'Download', onPress: jest.fn() } });
    expect(spy.mock.lastCall?.[3]).toEqual({ cancelable: true });

    showStoryActions(story, setup());
    expect(spy.mock.lastCall?.[3]).toEqual({ cancelable: true });
  });
});
