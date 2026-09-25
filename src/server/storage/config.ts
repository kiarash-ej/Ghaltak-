import path from "node:path";
import { localDriver, s3Driver, type StorageDriver } from "./drivers";

// Picks the driver from environment variables (.env.example, "File storage").
// Not server-only, so one-off scripts (scripts/) use the exact same settings
// as the app.

type Env = Record<string, string | undefined>;

export function storageDriverName(env: Env = process.env): string {
  return env.STORAGE_DRIVER ?? "local";
}

/** Where the local driver keeps files: UPLOAD_DIR, default ./uploads. */
export function localStorageRoot(env: Env = process.env): string {
  return path.resolve(env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads"));
}

export function driverFromEnv(env: Env = process.env): StorageDriver {
  const required = (name: string): string => {
    const value = env[name];
    if (!value) throw new Error(`${name} is required when STORAGE_DRIVER=s3 (see .env.example)`);
    return value;
  };

  const driver = storageDriverName(env);
  if (driver === "local") return localDriver(localStorageRoot(env));
  if (driver === "s3") {
    return s3Driver({
      endpoint: required("S3_ENDPOINT"),
      region: env.S3_REGION ?? "default",
      accessKeyId: required("S3_ACCESS_KEY_ID"),
      secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
      buckets: { public: required("S3_BUCKET_PUBLIC"), private: required("S3_BUCKET_PRIVATE") },
    });
  }
  throw new Error(`Unknown STORAGE_DRIVER: ${driver}`);
}
