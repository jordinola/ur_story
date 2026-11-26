// music-metadata is ESM-only, so it is loaded with a dynamic import() and only when a duration is read.
const readMp3Duration = async (file) => {
  const { parseFile } = await import('music-metadata');
  const { format } = await parseFile(file, { duration: true });
  if (!format.duration) throw new Error(`No duration found in ${file}`);
  return format.duration;
};

module.exports = { readMp3Duration };
