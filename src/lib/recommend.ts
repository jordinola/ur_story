import type { Profile, Story } from '../types';

const AGE_FIT_POINTS = 10;
const AGE_PENALTY_PER_YEAR = 3;
const LANGUAGE_POINTS = 20;
const TAG_POINTS = 4;
const GENRE_POINTS = 4;
const DEFAULT_LIMIT = 10;

export type GenreGroup = { genre: string; stories: Story[] };

export type HomeSections = {
  continueListening: Story[];
  picked: Story[];
  genres: GenreGroup[];
};

function agePoints(story: Story, age: number): number {
  const { ageMin, ageMax } = story;
  const validRange = Number.isFinite(ageMin) && Number.isFinite(ageMax) && ageMin <= ageMax;
  if (!validRange || (age >= ageMin && age <= ageMax)) return AGE_FIT_POINTS;
  const yearsOutside = age < ageMin ? ageMin - age : age - ageMax;
  return Math.max(0, AGE_FIT_POINTS - AGE_PENALTY_PER_YEAR * yearsOutside);
}

function countShared(values: string[], wanted: Set<string>): number {
  return values.filter((value) => wanted.has(value)).length;
}

export function scoreStory(story: Story, profile: Profile): number {
  const interests = new Set(profile.tags);
  const languagePoints = profile.languages.includes(story.language) ? LANGUAGE_POINTS : 0;
  return (
    agePoints(story, profile.age) +
    languagePoints +
    countShared(story.tags, interests) * TAG_POINTS +
    countShared(story.genres, interests) * GENRE_POINTS
  );
}

export function recommend(
  stories: Story[],
  profile: Profile,
  opts: { limit?: number; exclude?: string[] } = {},
): Story[] {
  const { limit = DEFAULT_LIMIT, exclude = [] } = opts;
  const excluded = new Set(exclude);
  return stories
    .filter((story) => !excluded.has(story.id))
    .map((story, index) => ({ story, index, score: scoreStory(story, profile) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.story);
}

export function groupByGenre(stories: Story[]): GenreGroup[] {
  const byGenre = new Map<string, Story[]>();
  for (const story of stories) {
    for (const genre of story.genres) {
      const group = byGenre.get(genre);
      if (group) group.push(story);
      else byGenre.set(genre, [story]);
    }
  }
  return [...byGenre.entries()]
    .map(([genre, groupStories]) => ({ genre, stories: groupStories }))
    .sort((a, b) => b.stories.length - a.stories.length || a.genre.localeCompare(b.genre));
}

export function buildHomeSections(input: {
  stories: Story[];
  profile: Profile;
  progress: Record<string, number>;
  completed: string[];
}): HomeSections {
  const { stories, profile, progress, completed } = input;
  const done = new Set(completed);
  const continueListening = stories.filter((story) => (progress[story.id] ?? 0) > 0 && !done.has(story.id));
  // A kid can't follow a story in a language they don't speak, so picks are limited to theirs.
  const inTheirLanguages = stories.filter((story) => profile.languages.includes(story.language));
  const picked = recommend(inTheirLanguages, profile, { exclude: continueListening.map((story) => story.id) });
  return { continueListening, picked, genres: groupByGenre(stories) };
}
