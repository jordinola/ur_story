import { buildHomeSections, groupByGenre, recommend, scoreStory } from './recommend';
import type { Profile, Story } from '../types';

function makeStory(id: string, overrides: Partial<Story> = {}): Story {
  return {
    id,
    title: id,
    description: id,
    durationSec: 60,
    ageRange: '4-6',
    ageMin: 4,
    ageMax: 6,
    genres: [],
    tags: [],
    language: 'en',
    audio: `audio/${id}.mp3`,
    color: '#FFFFFF',
    emoji: '*',
    ...overrides,
  };
}

const profile: Profile = { id: 'p1', name: 'Kid', age: 5, tags: ['Animals', 'Space'], languages: ['en'], color: '#000000' };

describe('scoreStory', () => {
  it('ranks a story inside the age range above one 3+ years outside', () => {
    const inside = makeStory('in', { ageMin: 4, ageMax: 6 });
    const outside = makeStory('out', { ageMin: 9, ageMax: 12 });
    expect(scoreStory(inside, profile)).toBeGreaterThan(scoreStory(outside, profile));
  });

  it('ranks a matching language above a non-matching one', () => {
    const match = makeStory('m', { language: 'en' });
    const other = makeStory('o', { language: 'es' });
    expect(scoreStory(match, profile)).toBeGreaterThan(scoreStory(other, profile));
  });

  it('language mismatch outweighs a single tag match', () => {
    const tagButWrongLanguage = makeStory('t', { language: 'es', tags: ['Animals'] });
    const rightLanguage = makeStory('l', { language: 'en' });
    expect(scoreStory(rightLanguage, profile)).toBeGreaterThan(scoreStory(tagButWrongLanguage, profile));
  });

  it('raises the score for each shared tag', () => {
    const none = scoreStory(makeStory('a'), profile);
    const one = scoreStory(makeStory('b', { tags: ['Animals'] }), profile);
    const two = scoreStory(makeStory('c', { tags: ['Animals', 'Space'] }), profile);
    expect(one).toBeGreaterThan(none);
    expect(two).toBeGreaterThan(one);
  });

  it('raises the score for each shared genre', () => {
    const none = scoreStory(makeStory('a'), profile);
    const one = scoreStory(makeStory('b', { genres: ['Animals'] }), profile);
    const two = scoreStory(makeStory('c', { genres: ['Animals', 'Space'] }), profile);
    expect(one).toBeGreaterThan(none);
    expect(two).toBeGreaterThan(one);
  });

  it('never filters by age: far-out stories still get a number', () => {
    const score = scoreStory(makeStory('x', { ageMin: 14, ageMax: 16 }), profile);
    expect(typeof score).toBe('number');
    expect(Number.isNaN(score)).toBe(false);
  });

  it('treats non-finite or inverted age ranges as fitting all ages', () => {
    const fitsAll = scoreStory(makeStory('base'), profile);
    const corrupt = [
      makeStory('nan', { ageMin: NaN, ageMax: NaN }),
      makeStory('inf', { ageMin: 0, ageMax: Infinity }),
      makeStory('inv', { ageMin: 10, ageMax: 2 }),
    ];
    for (const story of corrupt) {
      const score = scoreStory(story, profile);
      expect(Number.isNaN(score)).toBe(false);
      expect(score).toBe(scoreStory(makeStory('ok', { ageMin: 0, ageMax: 99 }), profile));
    }
    expect(fitsAll).toBeGreaterThan(0);
  });
});

describe('recommend', () => {
  const stories = [
    makeStory('a', { tags: ['Animals'] }),
    makeStory('b', { tags: ['Animals', 'Space'] }),
    makeStory('c', { tags: ['Animals'] }),
    makeStory('d', { tags: ['Space'] }),
  ];

  it('honors limit', () => {
    expect(recommend(stories, profile, { limit: 2 })).toHaveLength(2);
  });

  it('defaults the limit to 10', () => {
    const many = Array.from({ length: 15 }, (_, i) => makeStory(`s${i}`));
    expect(recommend(many, profile)).toHaveLength(10);
  });

  it('honors exclude', () => {
    const ids = recommend(stories, profile, { exclude: ['b'] }).map((s) => s.id);
    expect(ids).not.toContain('b');
  });

  it('returns [] when nothing scores above 0', () => {
    const far = [makeStory('f', { ageMin: 15, ageMax: 17, language: 'fr' })];
    expect(recommend(far, profile)).toEqual([]);
  });

  it('is stable for ties (catalog order)', () => {
    const ids = recommend(stories, profile).map((s) => s.id);
    expect(ids).toEqual(['b', 'a', 'c', 'd']);
  });
});

describe('groupByGenre', () => {
  it('omits stories with no genre and orders by size then alphabetically', () => {
    const list = [
      makeStory('1', { genres: ['Magic'] }),
      makeStory('2', { genres: ['Animals', 'Magic'] }),
      makeStory('3', { genres: ['Bedtime'] }),
      makeStory('4'),
    ];
    const groups = groupByGenre(list);
    expect(groups.map((g) => g.genre)).toEqual(['Magic', 'Animals', 'Bedtime']);
    expect(groups[0]?.stories.map((s) => s.id)).toEqual(['1', '2']);
    expect(groups.flatMap((g) => g.stories).map((s) => s.id)).not.toContain('4');
  });
});

describe('buildHomeSections', () => {
  const list = [
    makeStory('a', { tags: ['Animals'], genres: ['Animals'] }),
    makeStory('b', { tags: ['Animals'] }),
    makeStory('c', { tags: ['Animals'] }),
  ];

  it('puts in-progress, uncompleted stories in continueListening and out of picked', () => {
    const result = buildHomeSections({ stories: list, profile, progress: { a: 30, c: 10 }, completed: ['c'] });
    expect(result.continueListening.map((s) => s.id)).toEqual(['a']);
    expect(result.picked.map((s) => s.id)).not.toContain('a');
    expect(result.picked.map((s) => s.id)).toEqual(['b', 'c']);
    expect(result.genres.map((g) => g.genre)).toEqual(['Animals']);
  });

  describe('language filter on picked', () => {
    const mixed = [
      makeStory('en1', { tags: ['Animals'], genres: ['Bedtime'] }),
      makeStory('es1', { language: 'es', tags: ['Animals', 'Space'], genres: ['Bedtime'] }),
    ];

    it("keeps stories outside an English-only kid's languages out of picked, but not out of genres", () => {
      const result = buildHomeSections({ stories: mixed, profile, progress: {}, completed: [] });
      expect(result.picked.map((s) => s.id)).toEqual(['en1']);
      expect(result.genres[0]?.stories.map((s) => s.id)).toEqual(['en1', 'es1']);
    });

    it('picks stories in every language a bilingual kid speaks', () => {
      const bilingual = { ...profile, languages: ['en', 'es'] };
      const result = buildHomeSections({ stories: mixed, profile: bilingual, progress: {}, completed: [] });
      expect(result.picked.map((s) => s.id).sort()).toEqual(['en1', 'es1']);
    });
  });
});
