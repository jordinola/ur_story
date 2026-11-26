/** @jest-environment node */
const { createR2Store, readR2Config } = require('./r2Store');

const fakeClient = (responses = []) => {
  const commands = [];
  return {
    commands,
    send: async (command) => {
      commands.push(command);
      return responses.shift() ?? {};
    },
  };
};

const keys = (from, count) => Array.from({ length: count }, (_, i) => ({ Key: `stories/k${from + i}` }));

describe('createR2Store', () => {
  it('follows continuation tokens so every key is listed (more than 1000 objects)', async () => {
    const client = fakeClient([
      { Contents: keys(0, 1000), IsTruncated: true, NextContinuationToken: 'next' },
      { Contents: keys(1000, 3), IsTruncated: false },
    ]);
    const result = await createR2Store(client, 'bucket').list('stories/');

    expect(result).toHaveLength(1003);
    expect(client.commands).toHaveLength(2);
    expect(client.commands[0].input).toMatchObject({ Bucket: 'bucket', Prefix: 'stories/' });
    expect(client.commands[1].input.ContinuationToken).toBe('next');
  });

  it('lists nothing from an empty bucket', async () => {
    expect(await createR2Store(fakeClient([{}]), 'bucket').list('stories/')).toEqual([]);
  });

  it('reads an object body as text', async () => {
    const client = fakeClient([{ Body: { transformToString: async () => 'hello' } }]);
    expect(await createR2Store(client, 'bucket').get('a')).toBe('hello');
    expect(client.commands[0].input).toEqual({ Bucket: 'bucket', Key: 'a' });
  });

  it('puts with content type and cache control', async () => {
    const client = fakeClient();
    await createR2Store(client, 'bucket').put('a.json', '{}', {
      contentType: 'application/json',
      cacheControl: 'public, max-age=60',
    });
    expect(client.commands[0].input).toEqual({
      Bucket: 'bucket',
      Key: 'a.json',
      Body: '{}',
      ContentType: 'application/json',
      CacheControl: 'public, max-age=60',
    });
  });

  it('deletes in batches of at most 1000 keys', async () => {
    const client = fakeClient();
    const all = Array.from({ length: 2500 }, (_, i) => `stories/k${i}`);
    await createR2Store(client, 'bucket').delete(all);

    expect(client.commands.map((c) => c.input.Delete.Objects.length)).toEqual([1000, 1000, 500]);
  });

  it('does nothing when there is nothing to delete', async () => {
    const client = fakeClient();
    await createR2Store(client, 'bucket').delete([]);
    expect(client.commands).toEqual([]);
  });

  it('fails when R2 reports a delete error', async () => {
    const client = fakeClient([{ Errors: [{ Key: 'a', Message: 'denied' }] }]);
    await expect(createR2Store(client, 'bucket').delete(['a'])).rejects.toThrow(/denied/);
  });
});

describe('readR2Config', () => {
  const env = {
    R2_ACCOUNT_ID: 'acc',
    R2_ACCESS_KEY_ID: 'key',
    R2_SECRET_ACCESS_KEY: 'secret',
    R2_BUCKET: 'bucket',
  };

  it('names every missing variable', () => {
    expect(() => readR2Config({})).toThrow(
      /R2_ACCOUNT_ID.*R2_ACCESS_KEY_ID.*R2_SECRET_ACCESS_KEY.*R2_BUCKET/s,
    );
    expect(() => readR2Config({ ...env, R2_BUCKET: '' })).toThrow(/R2_BUCKET/);
  });

  it('returns the config, with the public URL optional', () => {
    expect(readR2Config(env)).toEqual({
      accountId: 'acc',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
      bucket: 'bucket',
      publicBaseUrl: undefined,
    });
    expect(readR2Config({ ...env, R2_PUBLIC_BASE_URL: 'https://x.dev/' }).publicBaseUrl).toBe('https://x.dev');
  });
});
