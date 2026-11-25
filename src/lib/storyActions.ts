import { ActionSheetIOS, Alert, Platform } from 'react-native';
import type { Story } from '../types';

export type DownloadAction = {
  label: 'Download' | 'Cancel download' | 'Remove download';
  onPress: () => void;
};

type Handlers = {
  onPlayNext: () => void;
  onAddToQueue: () => void;
  /** Left out when there is nothing to offer, such as for the downloaded story that is playing. */
  download?: DownloadAction;
};

const PLAY_NEXT = 'Play next';
const ADD_TO_QUEUE = 'Add to queue';
const CANCEL = 'Cancel';

/** Asks what to do with a story: a native action sheet on iOS, an alert elsewhere. Cancel does nothing. */
export function showStoryActions(story: Story, { onPlayNext, onAddToQueue, download }: Handlers): void {
  const actions = [
    { text: PLAY_NEXT, onPress: onPlayNext },
    { text: ADD_TO_QUEUE, onPress: onAddToQueue },
    ...(download ? [{ text: download.label, onPress: download.onPress }] : []),
  ];

  if (Platform.OS === 'ios') {
    const destructive = download?.label === 'Remove download' ? { destructiveButtonIndex: actions.length - 1 } : {};
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: story.title,
        options: [...actions.map((a) => a.text), CANCEL],
        cancelButtonIndex: actions.length,
        ...destructive,
      },
      (index) => actions[index]?.onPress(),
    );
    return;
  }
  // Android's Alert keeps only the first three buttons, so with a download entry the Cancel button
  // gives way; cancelable lets back or a tap outside dismiss the dialog instead.
  const buttons = download ? actions : [...actions, { text: CANCEL, style: 'cancel' as const }];
  Alert.alert(story.title, undefined, buttons, { cancelable: true });
}
