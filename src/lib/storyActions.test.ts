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
});
