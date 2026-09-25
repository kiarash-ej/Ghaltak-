import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestS3 } from "@/test/s3";
import { localDriver, s3Driver, type StorageDriver } from "./drivers";
import { isValidKey } from "./keys";

// The same contract for both drivers: local disk (development) and S3
// (production), the latter against a real S3-compatible server in-process.

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const key = (folder = "products", ext = "png") => `${folder}/${randomUUID()}.${ext}`;

const BAD_KEYS = [
  "../.env",
  "products/../../.env",
  "products/..%2f..%2f.env",
  "products/not-a-uuid.png",
  `other/${randomUUID()}.png`,
  `products/${randomUUID()}.exe`,
  `/products/${randomUUID()}.png`,
  `products\\${randomUUID()}.png`,
  "",
];

function contract(name: string, make: () => Promise<{ driver: StorageDriver; cleanup: () => Promise<void> }>) {
  describe(name, () => {
    let driver: StorageDriver;
    let cleanup: () => Promise<void>;
    beforeAll(async () => ({ driver, cleanup } = await make()));
    afterAll(async () => cleanup());

    it("stores and returns the same bytes and content type", async () => {
      const k = key();
      await driver.put("public", k, PNG, "image/png");
      const got = await driver.get("public", k);
      expect(got && new Uint8Array(got.body)).toEqual(PNG);
      expect(got?.contentType).toBe("image/png");
    });

    it("returns null for a missing object", async () => {
      expect(await driver.get("public", key())).toBeNull();
    });

    it("deletes, and deleting twice is fine", async () => {
      const k = key("receipts");
      await driver.put("private", k, PNG, "image/png");
      await driver.delete("private", k);
      await driver.delete("private", k);
      expect(await driver.get("private", k)).toBeNull();
    });

    it("refuses keys that could escape its folder", async () => {
      for (const bad of BAD_KEYS) {
        await expect(driver.put("public", bad, PNG, "image/png"), bad).rejects.toThrow(/Invalid storage key/);
        await expect(driver.get("public", bad), bad).rejects.toThrow(/Invalid storage key/);
        await expect(driver.delete("public", bad), bad).rejects.toThrow(/Invalid storage key/);
      }
    });
  });
}

contract("local driver", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ghaltak-storage-"));
  return { driver: localDriver(root), cleanup: () => rm(root, { recursive: true, force: true }) };
});

contract("s3 driver (in-process S3-compatible server)", async () => {
  const s3 = await startTestS3();
  return { driver: s3Driver(s3.config), cleanup: s3.close };
});

describe("s3 buckets are separate", () => {
  it("an object in the private bucket is not readable from the public one", async () => {
    const s3 = await startTestS3({ public: "pub", private: "priv" });
    try {
      const driver = s3Driver(s3.config);
      const k = key("receipts");
      await driver.put("private", k, PNG, "image/png");
      expect(await driver.get("public", k)).toBeNull();
      expect(await driver.get("private", k)).not.toBeNull();
    } finally {
      await s3.close();
    }
  });
});

describe("local layout stays compatible with Phase 1 uploads", () => {
  it("writes products/<uuid>.png under the root, where Phase 1 files already are", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ghaltak-storage-"));
    try {
      const k = key();
      await localDriver(root).put("public", k, PNG, "image/png");
      expect(new Uint8Array(await readFile(path.join(root, ...k.split("/"))))).toEqual(PNG);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("accepts exactly the folders the app uses", () => {
    expect(isValidKey(key("products"))).toBe(true);
    expect(isValidKey(key("logos", "webp"))).toBe(true);
    expect(isValidKey(key("receipts", "jpg"))).toBe(true);
  });
});
