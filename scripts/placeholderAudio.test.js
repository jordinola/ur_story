const { parseArgs, planOutputs, buildFfmpegArgs } = require('./placeholderAudio');

const stories = [
  { id: 'a', audio: 'audio/a.mp3', durationSec: 300 },
  { id: 'b', audio: 'https://cdn.example.com/b.mp3', durationSec: 60 },
  { id: 'c', audio: 'audio/c.mp3', durationSec: 120 },
];

describe('parseArgs', () => {
  it('uses defaults with no flags', () => {
    expect(parseArgs([])).toEqual({ seconds: null, silent: false, force: false });
  });

  it('reads all flags', () => {
    expect(parseArgs(['--seconds', '5', '--silent', '--force'])).toEqual({
      seconds: 5,
      silent: true,
      force: true,
    });
  });

  it('rejects a bad --seconds value', () => {
    expect(() => parseArgs(['--seconds', 'abc'])).toThrow(/--seconds/);
    expect(() => parseArgs(['--seconds', '0'])).toThrow(/--seconds/);
  });

  it('rejects unknown flags', () => {
    expect(() => parseArgs(['--nope'])).toThrow(/Unknown/);
  });
});

describe('planOutputs', () => {
  it('maps story audio paths into the output dir and skips remote URLs', () => {
    const plan = planOutputs(stories, '/out', { seconds: null });
    expect(plan).toEqual([
      { id: 'a', file: '/out/audio/a.mp3', seconds: 300 },
      { id: 'c', file: '/out/audio/c.mp3', seconds: 120 },
    ]);
  });

  it('applies the seconds override', () => {
    const plan = planOutputs(stories, '/out', { seconds: 4 });
    expect(plan.map((p) => p.seconds)).toEqual([4, 4]);
  });

  it('rejects paths that escape the output dir', () => {
    expect(() =>
      planOutputs([{ id: 'x', audio: '../evil.mp3', durationSec: 1 }], '/out', { seconds: null }),
    ).toThrow(/outside/);
  });
});

describe('buildFfmpegArgs', () => {
  it('builds a quiet sine tone MP3', () => {
    const args = buildFfmpegArgs({ file: '/out/audio/a.mp3', seconds: 10 }, { silent: false });
    expect(args).toEqual([
      '-y', '-loglevel', 'error',
      '-f', 'lavfi', '-i', 'sine=frequency=220:sample_rate=44100',
      '-t', '10', '-af', 'volume=0.1',
      '-ac', '1', '-b:a', '64k',
      '/out/audio/a.mp3',
    ]);
  });

  it('builds silence when requested', () => {
    const args = buildFfmpegArgs({ file: '/out/a.mp3', seconds: 3 }, { silent: true });
    expect(args).toContain('anullsrc=r=44100:cl=mono');
    expect(args).not.toContain('-af');
  });
});
