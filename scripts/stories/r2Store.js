const {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectsCommand,
} = require('@aws-sdk/client-s3');

const DELETE_BATCH_SIZE = 1000;
const REQUIRED_ENV = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'];

const readR2Config = (env) => {
  const missing = REQUIRED_ENV.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing R2 settings: ${missing.join(', ')}. Add them to .env.local.`);
  }
  return {
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET,
    publicBaseUrl: env.R2_PUBLIC_BASE_URL ? env.R2_PUBLIC_BASE_URL.replace(/\/+$/, '') : undefined,
  };
};

const createS3Client = ({ accountId, accessKeyId, secretAccessKey }) =>
  new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

const createR2Store = (client, bucket) => ({
  list: async (prefix) => {
    const keys = [];
    let token;
    do {
      const page = await client.send(
        new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }),
      );
      keys.push(...(page.Contents ?? []).map((object) => object.Key));
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return keys;
  },

  get: async (key) => {
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return response.Body.transformToString();
  },

  put: async (key, body, { contentType, cacheControl }) => {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: cacheControl,
      }),
    );
  },

  delete: async (keys) => {
    for (let start = 0; start < keys.length; start += DELETE_BATCH_SIZE) {
      const batch = keys.slice(start, start + DELETE_BATCH_SIZE).map((Key) => ({ Key }));
      const response = await client.send(
        new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: batch, Quiet: true } }),
      );
      if (response.Errors?.length) {
        throw new Error(`Could not delete: ${response.Errors.map((e) => `${e.Key} (${e.Message})`).join(', ')}`);
      }
    }
  },
});

module.exports = { createR2Store, createS3Client, readR2Config };
