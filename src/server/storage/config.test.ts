import path from "node:path";
import { describe, expect, it } from "vitest";
import { driverFromEnv, localStorageRoot, storageDriverName } from "./config";

describe("storage configuration", () => {
  it("defaults to the local driver in ./uploads", () => {
    expect(storageDriverName({})).toBe("local");
    expect(localStorageRoot({})).toBe(path.resolve("uploads"));
    expect(localStorageRoot({ UPLOAD_DIR: "data/files" })).toBe(path.resolve("data/files"));
    expect(() => driverFromEnv({})).not.toThrow();
  });

  it("s3 names the missing variable instead of failing later", () => {
    expect(() => driverFromEnv({ STORAGE_DRIVER: "s3", S3_ENDPOINT: "http://s3.example" })).toThrow(
      /S3_ACCESS_KEY_ID is required/,
    );
  });

  it("refuses an unknown driver", () => {
    expect(() => driverFromEnv({ STORAGE_DRIVER: "ftp" })).toThrow(/Unknown STORAGE_DRIVER: ftp/);
  });
});
