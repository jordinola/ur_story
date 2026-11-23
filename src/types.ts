export type Story = {
  id: string;
  title: string;
  description: string;
  /** Approximate length in seconds (shown before the audio is loaded). */
  durationSec: number;
  ageRange: string;
  ageMin: number;
  ageMax: number;
  genres: string[];
  tags: string[];
  language: string;
  /** Path relative to ASSET_BASE_URL (e.g. "audio/moon.mp3") or a full https URL. */
  audio: string;
  /** Optional cover image path/URL. Falls back to color + emoji. */
  cover?: string;
  color: string;
  emoji: string;
};

export type LibraryState = {
  favorites: string[];
  /** Playback position in seconds per story id. */
  progress: Record<string, number>;
  completed: string[];
};

export type ProfileInput = { name: string; age: number; tags: string[]; languages: string[]; color: string };

export type Profile = ProfileInput & { id: string };
