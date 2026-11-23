import { makeGateQuestion } from './gateQuestion';

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('makeGateQuestion', () => {
  it('builds a times-table prompt whose answer is correct', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const q = makeGateQuestion(seeded(seed));
      const match = /^What is (\d) × (\d)\?$/.exec(q.prompt);
      expect(match).not.toBeNull();
      const a = Number(match?.[1]);
      const b = Number(match?.[2]);
      expect(a).toBeGreaterThanOrEqual(3);
      expect(a).toBeLessThanOrEqual(9);
      expect(b).toBeGreaterThanOrEqual(3);
      expect(b).toBeLessThanOrEqual(9);
      expect(q.answer).toBe(a * b);
    }
  });

  it('offers four distinct positive options including the answer', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const q = makeGateQuestion(seeded(seed));
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options).toContain(q.answer);
      expect(q.options.every((n) => Number.isInteger(n) && n > 0)).toBe(true);
    }
  });

  it('shuffles the answer position across seeds', () => {
    const positions = new Set<number>();
    for (let seed = 1; seed <= 60; seed++) {
      const q = makeGateQuestion(seeded(seed));
      positions.add(q.options.indexOf(q.answer));
    }
    expect(positions.size).toBeGreaterThan(1);
  });

  it('works with a degenerate random source', () => {
    for (const value of [0, 0.999999]) {
      const q = makeGateQuestion(() => value);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options).toContain(q.answer);
    }
  });

  it('works with the default random source', () => {
    const q = makeGateQuestion();
    expect(q.options).toContain(q.answer);
  });
});
