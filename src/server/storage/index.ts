import "server-only";
import { driverFromEnv } from "./config";
import type { StorageDriver } from "./drivers";

// File storage for the whole app (docs/phase2/TRACK-A.md, Step 0).
// STORAGE_DRIVER=local (default, development) or s3 (production).
//
// Cross-track contract: Track B moves payment receipts here (bucket
// "private"); Track A moves product images and logos here (bucket "public").

export { CONTENT_TYPES, isValidKey, type Bucket, type ImageExtension } from "./keys";
export type { StorageDriver, StoredObject } from "./drivers";

let driver: StorageDriver | undefined;

/** The configured storage, created on first use. */
export function storage(): StorageDriver {
  driver ??= driverFromEnv();
  return driver;
}
