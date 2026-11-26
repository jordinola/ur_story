const fs = require('node:fs');
const path = require('node:path');
const { readStoryFolder, StoryValidationError } = require('./stories/storyFolder');
const { buildCatalog, uploadIndex, publishStory, removeStory } = require('./stories/flows');
const { INDEX_KEY } = require('./stories/catalog');

const COMMANDS = ['publish', 'remove', 'index'];

const parseArgs = (argv) => {
  const [command, ...rest] = argv;
  if (!COMMANDS.includes(command)) {
    throw new Error(`Usage: story:publish <folder...|--all> [--dry-run] | story:remove <id> | story:index`);
  }
  const options = { command, folders: [], all: false, dryRun: false };
  const positional = [];
  rest.forEach((arg) => {
    if (arg === '--all') options.all = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg.startsWith('--')) throw new Error(`Unknown option: ${arg}`);
    else positional.push(arg);
  });
  if (command === 'publish') {
    if (positional.length === 0 && !options.all) throw new Error('publish needs a folder or --all');
    options.folders = positional;
  }
  if (command === 'remove') {
    if (positional.length !== 1) throw new Error('remove needs exactly one story id');
    options.id = positional[0];
  }
  return options;
};

const listStoryFolders = (contentRoot) =>
  fs
    .readdirSync(contentRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(contentRoot, entry.name))
    .sort();

// Validates every folder before anything is uploaded, so one bad story never leaves a half-published run.
const readAllFolders = async (dirs, readDuration) => {
  const folders = [];
  const problems = [];
  for (const dir of dirs) {
    try {
      folders.push(await readStoryFolder(dir, readDuration));
    } catch (error) {
      if (!(error instanceof StoryValidationError)) throw error;
      problems.push(error.message);
    }
  }
  if (problems.length > 0) throw new Error(`Nothing was uploaded.\n${problems.join('\n')}`);
  return folders;
};

const urlFor = (base, key) => (base ? `${base}/${key}` : key);

const runPublish = async (options, { store, readDuration, contentRoot, log, publicBaseUrl }) => {
  const dirs = options.all ? listStoryFolders(contentRoot) : options.folders.map((folder) => path.resolve(folder));
  const folders = await readAllFolders(dirs, readDuration);
  const verb = options.dryRun ? 'would publish' : 'published';
  for (const folder of folders) {
    const { uploaded, indexCount } = await publishStory(store, folder, { dryRun: options.dryRun });
    log(`${verb} ${folder.meta.id} (${folder.meta.durationSec}s, ${uploaded.length} files, ${indexCount} stories in the index)`);
    if (!options.dryRun) uploaded.forEach((key) => log(`  ${urlFor(publicBaseUrl, key)}`));
  }
  if (!options.dryRun && folders.length > 0) log(`index: ${urlFor(publicBaseUrl, INDEX_KEY)}`);
};

const run = async (argv, deps) => {
  const options = parseArgs(argv);
  if (options.command === 'publish') return runPublish(options, deps);
  if (options.command === 'remove') {
    const { deleted } = await removeStory(deps.store, options.id, { dryRun: options.dryRun });
    deps.log(`${options.dryRun ? 'would remove' : 'removed'} ${options.id} (${deleted.length} files)`);
    return undefined;
  }
  const catalog = await buildCatalog(deps.store);
  if (!options.dryRun) await uploadIndex(deps.store, catalog);
  deps.log(`${options.dryRun ? 'would write' : 'wrote'} ${INDEX_KEY} with ${catalog.length} stories`);
  return undefined;
};

const main = async () => {
  const root = path.resolve(__dirname, '..');
  const envFile = path.join(root, '.env.local');
  if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

  const { readR2Config, createS3Client, createR2Store } = require('./stories/r2Store');
  const { readMp3Duration } = require('./stories/audioDuration');
  const config = readR2Config(process.env);

  await run(process.argv.slice(2), {
    store: createR2Store(createS3Client(config), config.bucket),
    readDuration: readMp3Duration,
    contentRoot: path.join(root, 'content', 'stories'),
    log: console.log,
    publicBaseUrl: config.publicBaseUrl,
  });
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

module.exports = { parseArgs, run };
