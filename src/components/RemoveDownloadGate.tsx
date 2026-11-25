import { useEffect } from 'react';
import { Modal } from 'react-native';
import { useBedtime } from '../lib/BedtimeProvider';
import { useDownloads } from '../lib/DownloadsProvider';
import { usePlayer } from '../lib/PlayerProvider';
import { useReduceMotion } from '../lib/useReduceMotion';
import { ParentalGate } from './ParentalGate';

// Mounted once in the root layout so this gate never stacks on another modal: callers close
// their own sheet before calling requestRemove.
export function RemoveDownloadGate() {
  const { pendingRemoval, confirmRemoval, dismissRemoval } = useDownloads();
  const { locked } = useBedtime();
  const currentId = usePlayer().current?.id;
  const reduceMotion = useReduceMotion();

  // A Modal draws over the bedtime lock overlay, so give way to the lock (as BedtimeEntry does).
  useEffect(() => {
    if (locked && pendingRemoval) dismissRemoval();
  }, [locked, pendingRemoval, dismissRemoval]);

  if (!pendingRemoval || locked) return null;

  // The story may have started playing while the gate was open; its file is in use then.
  const pass = pendingRemoval.id === currentId ? dismissRemoval : confirmRemoval;

  return (
    <Modal
      visible
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={dismissRemoval}
      supportedOrientations={['portrait', 'landscape']}
    >
      <ParentalGate
        message={`Remove "${pendingRemoval.title}" from this device?`}
        onPass={pass}
        onCancel={dismissRemoval}
      />
    </Modal>
  );
}
