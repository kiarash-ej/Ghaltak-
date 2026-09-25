import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestS3 } from "@/test/s3";
import { copyFolderToStorage } from "./copy-folder";
import { s3Driver, type StorageDriver } from "./drivers";

// The one-time move of Phase 1 product images (uploads/products) to S3.

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 4, 5, 6]);

describe("copyFolderToStorage", () => {
  let source: string;
  let s3: Awaited<ReturnType<typeof startTestS3>>;
  let to: StorageDriver;
  const png = `${randomUUID()}.png`;
  const jpg = `${randomUUID()}.jpg`;
  const lying = `${randomUUID()}.jpg`; // PNG bytes under a .jpg name

  beforeAll(async () => {
    source = await mkdtemp(path.join(tmpdir(), "ghaltak-old-uploads-"));
    const dir = path.join(source, "products");
    await mkdir(path.join(dir, "subfolder"), { recursive: true });
    await writeFile(path.join(dir, png), PNG);
    await writeFile(path.join(dir, jpg), JPG);
    await writeFile(path.join(dir, lying), PNG);
    await writeFile(path.join(dir, "notes.txt"), "hello");
    s3 = await startTestS3();
    to = s3Driver(s3.config);
  });
  afterAll(async () => {
    await s3.close();
    await rm(source, { recursive: true, force: true });
  });

  it("copies valid images to the public bucket and skips everything else", async () => {
    const report = await copyFolderToStorage({ sourceRoot: source, folder: "products", bucket: "public", to });

    expect(report.copied.sort()).toEqual([jpg, png].sort());
    expect(report.skipped.map((s) => s.name).sort()).toEqual([lying, "notes.txt", "subfolder"].sort());

    const got = await to.get("public", `products/${png}`);
    expect(got && new Uint8Array(got.body)).toEqual(PNG);
    expect(got?.contentType).toBe("image/png");
    expect((await to.get("public", `products/${jpg}`))?.contentType).toBe("image/jpeg");
    expect(await to.get("private", `products/${png}`)).toBeNull();
  });

  it("leaves the source untouched and is safe to run again", async () => {
    const before = await readdir(path.join(source, "products"));
    const again = await copyFolderToStorage({ sourceRoot: source, folder: "products", bucket: "public", to });
    expect(again.copied).toHaveLength(2);
    expect(await readdir(path.join(source, "products"))).toEqual(before);
  });

  it("does nothing when the folder doesn't exist", async () => {
    const empty = await mkdtemp(path.join(tmpdir(), "ghaltak-empty-"));
    try {
      expect(await copyFolderToStorage({ sourceRoot: empty, folder: "products", bucket: "public", to })).toEqual({
        copied: [],
        skipped: [],
      });
    } finally {
      await rm(empty, { recursive: true, force: true });
    }
  });
});
