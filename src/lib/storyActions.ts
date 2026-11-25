import { ActionSheetIOS, Alert, Platform } from 'react-native';
import type { Story } from '../types';

type Handlers = { onPlayNext: () => void; onAddToQueue: () => void };

const PLAY_NEXT = 'Play next';
const ADD_TO_QUEUE = 'Add to queue';
const CANCEL = 'Cancel';

/** Asks what to do with a story: a native action sheet on iOS, an alert elsewhere. Cancel does nothing. */
export function showStoryActions(story: Story, { onPlayNext, onAddToQueue }: Handlers): void {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { title: story.title, options: [PLAY_NEXT, ADD_TO_QUEUE, CANCEL], cancelButtonIndex: 2 },
      (index) => {
        if (index === 0) onPlayNext();
        else if (index === 1) onAddToQueue();
      },
    );
    return;
  }
  Alert.alert(story.title, undefined, [
    { text: PLAY_NEXT, onPress: onPlayNext },
    { text: ADD_TO_QUEUE, onPress: onAddToQueue },
    { text: CANCEL, style: 'cancel' },
  ]);
}
