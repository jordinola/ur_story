import {
  MAX_PROFILES,
  getInitials,
  parseStoredProfiles,
  validateProfileInput,
} from './profiles';

const valid = { name: 'Mia', age: 6, tags: ['Animals'], languages: ['en'] };
const stored = { id: 'p1', name: 'Mia', age: 6, tags: ['Animals'], languages: ['en'], color: '#1D4ED8' };

describe('MAX_PROFILES', () => {
  it('is six', () => {
    expect(MAX_PROFILES).toBe(6);
  });
});

describe('validateProfileInput', () => {
  it('accepts valid input and trims the name', () => {
    expect(validateProfileInput({ ...valid, name: '  Mia ' })).toEqual({ ok: true, value: valid });
  });

  it.each([
    [1, false],
    [2, true],
    [12, true],
    [13, false],
    [5.5, false],
    [Number.NaN, false],
  ])('age %s is ok=%s', (age, ok) => {
    const result = validateProfileInput({ ...valid, age });
    expect(result.ok).toBe(ok);
    if (!result.ok) expect(result.errors.age).toBeDefined();
  });

  it.each([
    ['   ', false],
    ['a', true],
    ['a'.repeat(20), true],
    ['a'.repeat(21), false],
  ])('name %j is ok=%s', (name, ok) => {
    const result = validateProfileInput({ ...valid, name });
    expect(result.ok).toBe(ok);
    if (!result.ok) expect(result.errors.name).toBeDefined();
  });

  it('requires at least one language', () => {
    const result = validateProfileInput({ ...valid, languages: [] });
    expect(result).toEqual({ ok: false, errors: { languages: expect.any(String) } });
  });

  it('reports every failing field', () => {
    const result = validateProfileInput({ name: '', age: 0, tags: [], languages: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['age', 'languages', 'name']);
  });

  it('drops unknown and duplicate tags', () => {
    const result = validateProfileInput({ ...valid, tags: ['Animals', 'Animals', 'Nope', 'Space'] });
    expect(result).toEqual({ ok: true, value: { ...valid, tags: ['Animals', 'Space'] } });
  });
});

describe('parseStoredProfiles', () => {
  const empty = { profiles: [], activeId: null };

  it('returns empty for null, invalid JSON and wrong shapes', () => {
    expect(parseStoredProfiles(null)).toEqual(empty);
    expect(parseStoredProfiles('{oops')).toEqual(empty);
    expect(parseStoredProfiles('42')).toEqual(empty);
    expect(parseStoredProfiles(JSON.stringify({ profiles: 'x', activeId: 'p1' }))).toEqual(empty);
  });

  it('keeps valid profiles and the active id', () => {
    const raw = JSON.stringify({ profiles: [stored], activeId: 'p1' });
    expect(parseStoredProfiles(raw)).toEqual({ profiles: [stored], activeId: 'p1' });
  });

  it('drops invalid entries and duplicate ids but keeps the rest', () => {
    const raw = JSON.stringify({
      profiles: [stored, { ...stored, id: 'bad', age: 99 }, { ...stored, id: 'p3', color: 5 }, stored, null, { ...stored, id: 'p2' }],
      activeId: 'p2',
    });
    const result = parseStoredProfiles(raw);
    expect(result.profiles.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(result.activeId).toBe('p2');
  });

  it('falls back to the first profile for an unknown active id, or null when none', () => {
    const raw = JSON.stringify({ profiles: [stored], activeId: 'ghost' });
    expect(parseStoredProfiles(raw).activeId).toBe('p1');
    expect(parseStoredProfiles(JSON.stringify({ profiles: [], activeId: 'ghost' })).activeId).toBeNull();
  });

  it('keeps at most MAX_PROFILES', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ ...stored, id: `p${i}` }));
    expect(parseStoredProfiles(JSON.stringify({ profiles: many, activeId: null })).profiles).toHaveLength(6);
  });
});

describe('getInitials', () => {
  it.each([
    ['Mia Rose', 'MR'],
    ['  ana', 'A'],
    ['mary jane watson', 'MJ'],
    ['', ''],
  ])('%j -> %j', (name, expected) => {
    expect(getInitials(name)).toBe(expected);
  });
});
