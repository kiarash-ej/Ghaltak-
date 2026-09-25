import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { assertValidKey, contentTypeOf, type Bucket } from "./keys";

// No "server-only" here so the drivers can be tested directly; the public
// entry point (./index.ts) is server-only.

export type StoredObject = { body: Buffer; contentType: string };

export interface StorageDriver {
  put(bucket: Bucket, key: string, body: Uint8Array, contentType: string): Promise<void>;
  /** null when the object doesn't exist. */
  get(bucket: Bucket, key: string): Promise<StoredObject | null>;
  /** Deleting a missing object is not an error. */
  delete(bucket: Bucket, key: string): Promise<void>;
}

/**
 * Local disk, for development (and the old Phase 1 layout): both buckets live
 * under one root, separated by the key's folder ("products/…", "receipts/…"),
 * so files uploaded before Phase 2 keep working unchanged.
 */
export function localDriver(root: string): StorageDriver {
  const file = (key: string) => {
    assertValidKey(key);
    return path.join(root, ...key.split("/"));
  };
  return {
    async put(_bucket, key, body) {
      const target = file(key);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, body);
    },
    async get(_bucket, key) {
      try {
        return { body: await readFile(file(key)), contentType: contentTypeOf(key) };
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
    },
    async delete(_bucket, key) {
      try {
        await unlink(file(key));
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      }
    },
  };
}

export type S3Config = {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  buckets: Record<Bucket, string>;
};

/**
 * Any S3-compatible service (ArvanCloud, Liara, MinIO). Both buckets are
 * PRIVATE at the S3 level: the app reads objects and serves them itself
 * (/uploads/products/…, /orders/[id]/receipt), so no object is ever
 * reachable by a public S3 URL and access rules stay in our code.
 */
export function s3Driver(config: S3Config): StorageDriver {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    forcePathStyle: true, // what S3-compatible services expect
  });
  return {
    async put(bucket, key, body, contentType) {
      assertValidKey(key);
      await client.send(
        new PutObjectCommand({ Bucket: config.buckets[bucket], Key: key, Body: body, ContentType: contentType }),
      );
    },
    async get(bucket, key) {
      assertValidKey(key);
      try {
        const res = await client.send(new GetObjectCommand({ Bucket: config.buckets[bucket], Key: key }));
        const bytes = await res.Body!.transformToByteArray();
        return { body: Buffer.from(bytes), contentType: res.ContentType ?? contentTypeOf(key) };
      } catch (err) {
        if (err instanceof NoSuchKey || (err as { name?: string }).name === "NoSuchKey") return null;
        throw err;
      }
    },
    async delete(bucket, key) {
      assertValidKey(key);
      await client.send(new DeleteObjectCommand({ Bucket: config.buckets[bucket], Key: key }));
    },
  };
}
