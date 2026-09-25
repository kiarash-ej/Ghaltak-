import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { s3Driver, type S3Config } from "@/server/storage/drivers";
import { startTestS3 } from "@/test/s3";

// Payment receipts through the storage module (B6), on both drivers,
// configured the way the app configures them: environment variables only.

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const file = (bytes: Uint8Array<ArrayBuffer>, name = "receipt.png") => new File([bytes], name, { type: "image/png" });

type ReceiptStorage = typeof import("./receipt-storage");

async function loadWith(env: Record<string, string>): Promise<ReceiptStorage> {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import("./receipt-storage");
}

describe("receipts on the local driver", () => {
  let receipts: ReceiptStorage;
  let root: string;

  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), "ghaltak-receipts-"));
    receipts = await loadWith({ STORAGE_DRIVER: "local", UPLOAD_DIR: root });
  });
  afterAll(async () => {
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  });

  it("keeps Phase 1's place on disk (uploads/receipts), so old receipts still work", async () => {
    const saved = await receipts.saveReceipt(file(PNG));
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.key).toMatch(/^receipts\/[0-9a-f-]{36}\.png$/);
    const onDisk = await readFile(path.join(root, saved.key));
    expect(new Uint8Array(onDisk)).toEqual(PNG);

    const back = await receipts.readReceipt(saved.key);
    expect(back?.contentType).toBe("image/png");
    expect(new Uint8Array(back!.body)).toEqual(PNG);
  });

  it("deletes a receipt, and ignores keys that aren't receipts", async () => {
    const saved = await receipts.saveReceipt(file(PNG));
    if (!saved.ok) throw new Error("save failed");
    await receipts.deleteReceipt(saved.key);
    expect(await receipts.readReceipt(saved.key)).toBeNull();
    await expect(receipts.deleteReceipt("products/00000000-0000-0000-0000-000000000000.png")).resolves.toBeUndefined();
    await expect(receipts.deleteReceipt(null)).resolves.toBeUndefined();
  });
});

describe("receipts on the s3 driver", () => {
  let receipts: ReceiptStorage;
  let s3: { config: S3Config; close: () => Promise<void> };

  beforeAll(async () => {
    s3 = await startTestS3();
    const c = s3.config;
    receipts = await loadWith({
      STORAGE_DRIVER: "s3",
      S3_ENDPOINT: c.endpoint,
      S3_REGION: c.region,
      S3_ACCESS_KEY_ID: c.accessKeyId,
      S3_SECRET_ACCESS_KEY: c.secretAccessKey,
      S3_BUCKET_PUBLIC: c.buckets.public,
      S3_BUCKET_PRIVATE: c.buckets.private,
    });
  });
  afterAll(async () => {
    vi.unstubAllEnvs();
    await s3?.close();
  });

  it("stores receipts in the PRIVATE bucket only", async () => {
    const saved = await receipts.saveReceipt(file(PNG));
    if (!saved.ok) throw new Error("save failed");

    const direct = s3Driver(s3.config);
    expect(new Uint8Array((await direct.get("private", saved.key))!.body)).toEqual(PNG);
    expect(await direct.get("public", saved.key)).toBeNull();

    expect(new Uint8Array((await receipts.readReceipt(saved.key))!.body)).toEqual(PNG);
    await receipts.deleteReceipt(saved.key);
    expect(await direct.get("private", saved.key)).toBeNull();
  });
});

describe("receipt validation (any driver)", () => {
  let receipts: ReceiptStorage;
  let root: string;

  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), "ghaltak-receipts-"));
    receipts = await loadWith({ STORAGE_DRIVER: "local", UPLOAD_DIR: root });
  });
  afterAll(async () => {
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  });

  it("refuses empty, oversize and non-image files", async () => {
    expect((await receipts.saveReceipt(file(new Uint8Array(0)))).ok).toBe(false);
    const big = new Uint8Array(receipts.MAX_RECEIPT_BYTES + 1);
    big.set(PNG);
    expect((await receipts.saveReceipt(file(big))).ok).toBe(false);
    expect((await receipts.saveReceipt(file(new TextEncoder().encode("<svg onload=alert(1)>"), "x.png"))).ok).toBe(false);
  });

  it("reads only receipt keys: no other folder, no path tricks", async () => {
    for (const key of [
      "products/00000000-0000-0000-0000-000000000000.png",
      "receipts/../.env",
      "../receipts/00000000-0000-0000-0000-000000000000.png",
      "receipts/not-a-uuid.png",
      "",
    ]) {
      expect(await receipts.readReceipt(key)).toBeNull();
    }
  });
});
