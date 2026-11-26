// In-memory Store used by the tests. Mirrors the R2 store's interface and records every write in order.
const createMemoryStore = (initial = {}) => {
  const objects = new Map(Object.entries(initial).map(([key, body]) => [key, { body }]));
  const calls = [];

  return {
    objects,
    calls,
    list: async (prefix) => [...objects.keys()].filter((key) => key.startsWith(prefix)).sort(),
    get: async (key) => {
      const object = objects.get(key);
      if (!object) throw new Error(`No such key: ${key}`);
      return object.body;
    },
    put: async (key, body, { contentType, cacheControl }) => {
      calls.push(`put:${key}`);
      objects.set(key, { body: String(body), contentType, cacheControl });
    },
    delete: async (keys) => {
      keys.forEach((key) => {
        calls.push(`delete:${key}`);
        objects.delete(key);
      });
    },
  };
};

module.exports = { createMemoryStore };
