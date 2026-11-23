export type GateQuestion = { prompt: string; answer: number; options: number[] };

const MIN_FACTOR = 3;
const MAX_FACTOR = 9;
const OPTION_COUNT = 4;

const pickInt = (random: () => number, min: number, max: number) =>
  min + Math.min(max - min, Math.floor(random() * (max - min + 1)));

/** Wrong answers a child could plausibly misjudge: near the answer, positive, never equal to it. */
function makeDistractors(answer: number, random: () => number): number[] {
  const picked = new Set<number>();
  for (let attempts = 0; picked.size < OPTION_COUNT - 1 && attempts < 100; attempts++) {
    const candidate = answer + pickInt(random, -10, 10);
    if (candidate > 0 && candidate !== answer) picked.add(candidate);
  }
  // Deterministic fallback so a degenerate random source can never leave us short.
  for (let offset = 1; picked.size < OPTION_COUNT - 1; offset++) picked.add(answer + offset);
  return [...picked];
}

function shuffle(items: number[], random: () => number): number[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = pickInt(random, 0, i);
    const a = result[i];
    const b = result[j];
    if (a === undefined || b === undefined) continue;
    result[i] = b;
    result[j] = a;
  }
  return result;
}

export function makeGateQuestion(random: () => number = Math.random): GateQuestion {
  const a = pickInt(random, MIN_FACTOR, MAX_FACTOR);
  const b = pickInt(random, MIN_FACTOR, MAX_FACTOR);
  const answer = a * b;
  return {
    prompt: `What is ${a} × ${b}?`,
    answer,
    options: shuffle([answer, ...makeDistractors(answer, random)], random),
  };
}
