const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SAMPLE_RATE = 44100;

const parseArgs = (argv) => {
  const options = { seconds: null, silent: false, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--silent') options.silent = true;
    else if (arg === '--force') options.force = true;
    else if (arg === '--seconds') {
      const value = Number(argv[i + 1]);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error('--seconds needs a positive number');
      }
      options.seconds = value;
      i += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
};

const planOutputs = (stories, outDir, { seconds }) =>
  stories
    .filter((story) => !/^https?:\/\//.test(story.audio))
    .map((story) => {
      const file = path.resolve(outDir, story.audio);
      if (!file.startsWith(path.resolve(outDir) + path.sep)) {
        throw new Error(`Audio path for "${story.id}" points outside the output folder`);
      }
      return { id: story.id, file, seconds: seconds ?? story.durationSec };
    });

const buildFfmpegArgs = ({ file, seconds }, { silent }) => {
  const source = silent
    ? ['-f', 'lavfi', '-i', `anullsrc=r=${SAMPLE_RATE}:cl=mono`]
    : ['-f', 'lavfi', '-i', `sine=frequency=220:sample_rate=${SAMPLE_RATE}`];
  const filter = silent ? [] : ['-af', 'volume=0.1'];
  return [
    '-y', '-loglevel', 'error',
    ...source,
    '-t', String(seconds), ...filter,
    '-ac', '1', '-b:a', '64k',
    file,
  ];
};

const main = () => {
  const options = parseArgs(process.argv.slice(2));
  const root = path.resolve(__dirname, '..');
  const stories = JSON.parse(fs.readFileSync(path.join(root, 'src/data/stories.json'), 'utf8'));
  const outDir = path.join(root, 'placeholder-audio');

  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  } catch {
    throw new Error('ffmpeg not found. Install it with: brew install ffmpeg');
  }

  planOutputs(stories, outDir, options).forEach((item) => {
    if (fs.existsSync(item.file) && !options.force) {
      console.log(`skip   ${path.relative(root, item.file)} (exists)`);
      return;
    }
    fs.mkdirSync(path.dirname(item.file), { recursive: true });
    execFileSync('ffmpeg', buildFfmpegArgs(item, options), { stdio: 'inherit' });
    console.log(`wrote  ${path.relative(root, item.file)} (${item.seconds}s)`);
  });
};

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

module.exports = { parseArgs, planOutputs, buildFfmpegArgs };
