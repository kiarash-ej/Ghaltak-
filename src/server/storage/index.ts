import "server-only";
import path from "node:path";
import { localDriver, s3Driver, type StorageDriver } from "./drivers";

// File storage for the whole app (docs/phase2/TRACK-A.md, Step 0).
// STORAGE_DRIVER=local (default, development) or s3 (production).
//
// Cross-track contract: Track B moves payment receipts here (bucket
// "private"); Track A moves product images and logos here (bucket "public").

export { CONTENT_TYPES, isValidKey, type Bucket, type ImageExtension } from "./keys";
export type { StoredObject } from "./drivers";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required when STORAGE_DRIVER=s3 (see .env.example)`);
  return value;
}

function createDriver(): StorageDriver {
  const driver = process.env.STORAGE_DRIVER ?? "local";
  if (driver === "local") {
    return localDriver(process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads"));
  }
  if (driver === "s3") {
    return s3Driver({
      endpoint: required("S3_ENDPOINT"),
      region: process.env.S3_REGION ?? "default",
      accessKeyId: required("S3_ACCESS_KEY_ID"),
      secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
      buckets: { public: required("S3_BUCKET_PUBLIC"), private: required("S3_BUCKET_PRIVATE") },
    });
  }
  throw new Error(`Unknown STORAGE_DRIVER: ${driver}`);
}

let driver: StorageDriver | undefined;

/** The configured storage, created on first use. */
export function storage(): StorageDriver {
  driver ??= createDriver();
  return driver;
}
