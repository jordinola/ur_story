import type { Story } from '../types';

export const DOWNLOADS_DIR_NAME = 'downloads';
export const PART_SUFFIX = '.part';

const DEFAULT_EXTENSION = 'mp3';
const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

export function audioExtension(audioPath: string): string {
  const withoutQuery = audioPath.split(/[?#]/)[0] ?? '';
  const lastSegment = withoutQuery.split('/').pop() ?? '';
  const dotIndex = lastSegment.lastIndexOf('.');
  if (dotIndex < 0) return DEFAULT_EXTENSION;
  const extension = lastSegment.slice(dotIndex + 1).toLowerCase();
  return /^[a-z0-9]+$/.test(extension) ? extension : DEFAULT_EXTENSION;
}

export function downloadFileName(story: Story): string {
  return `${story.id}.${audioExtension(story.audio)}`;
}

export function partFileName(story: Story): string {
  return `${downloadFileName(story)}${PART_SUFFIX}`;
}

export function isPartFile(fileName: string): boolean {
  return fileName.endsWith(PART_SUFFIX);
}

export function storyIdFromFileName(fileName: string): string | null {
  if (isPartFile(fileName)) return null;
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex > 0 ? fileName.slice(0, dotIndex) : null;
}

/** `trimZero` drops a trailing `.0` from MB and GB sizes (`42 MB`, but still `4.2 MB`). */
export function formatBytes(bytes: number, { trimZero = false }: { trimZero?: boolean } = {}): string {
  const safe = Number.isFinite(bytes) ? Math.max(0, bytes) : 0;
  const oneDecimal = (value: number) => {
    const fixed = value.toFixed(1);
    return trimZero && fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed;
  };
  if (safe >= GB) return `${oneDecimal(safe / GB)} GB`;
  if (safe >= MB) return `${oneDecimal(safe / MB)} MB`;
  return `${Math.round(safe / KB)} KB`;
}
