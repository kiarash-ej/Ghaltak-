import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { s3Driver, type S3Config } from "@/server/storage/drivers";
import { startTestS3 } from "@/test/s3";

// Product images through the storage module, with each driver configured the
// way the app configures it: environment variables only.

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7, 7, 7]);
const file = (bytes: Uint8Array<ArrayBuffer>, name = "photo.png") => new File([bytes], name, { type: "image/png" });

type ImageStorage = typeof import("./image-storage");

function s3Env(config: S3Config): Record<string, string> {
  return {
    STORAGE_DRIVER: "s3",
    S3_ENDPOINT: config.endpoint,
    S3_REGION: config.region,
    S3_ACCESS_KEY_ID: config.accessKeyId,
    S3_SECRET_ACCESS_KEY: config.secretAccessKey,
    S3_BUCKET_PUBLIC: config.buckets.public,
    S3_BUCKET_PRIVATE: config.buckets.private,
  };
}

/** A fresh copy of the module (and of its storage() singleton) under `env`. */
async function loadWith(env: Record<string, string>): Promise<ImageStorage> {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import("./image-storage");
}

function suite(
  name: string,
  setup: () => Promise<{ env: Record<string, string>; config?: S3Config; cleanup: () => Promise<void> }>,
) {
  describe(name, () => {
    let images: ImageStorage;
    let config: S3Config | undefined;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const s = await setup();
      ({ config, cleanup } = s);
      images = await loadWith(s.env);
    });
    afterAll(async () => {
      vi.unstubAllEnvs();
      await cleanup();
    });

    it("saves, serves and deletes an image under the Phase 1 URL", async () => {
      const saved = await images.saveProductImage(file(PNG));
      if (!saved.ok) throw new Error(saved.error);
      expect(saved.url).toMatch(/^\/uploads\/products\/[0-9a-f-]{36}\.png$/);

      const name = saved.url.split("/").pop()!;
      const served = await images.readProductImage(name);
      expect(served && new Uint8Array(served.body)).toEqual(PNG);
      expect(served?.contentType).toBe("image/png");

      if (config) {
        // It really is in the public bucket of the S3 service.
        const direct = await s3Driver(config).get("public", `products/${name}`);
        expect(direct && new Uint8Array(direct.body)).toEqual(PNG);
      }

      await images.deleteProductImage(saved.url);
      expect(await images.readProductImage(name)).toBeNull();
    });

    it("stores by content, not by the name or type the browser sent", async () => {
      const notImage = await images.saveProductImage(file(new TextEncoder().encode("<svg/>"), "x.png"));
      expect(notImage).toEqual({ ok: false, error: expect.stringContaining("JPG") });

      const png = await images.saveProductImage(file(PNG, "photo.jpg"));
      expect(png.ok && png.url.endsWith(".png")).toBe(true);
    });

    it("refuses files over 2MB", async () => {
      const big = new Uint8Array(images.MAX_IMAGE_BYTES + 1);
      big.set(PNG);
      expect((await images.saveProductImage(file(big))).ok).toBe(false);
    });

    it("serves nothing for names that are not <uuid>.<ext>", async () => {
      for (const bad of ["../../.env", "..%2f.env", "x.png", `${randomUUID()}.svg`, `../receipts/${randomUUID()}.png`]) {
        expect(await images.readProductImage(bad), bad).toBeNull();
      }
    });

    it("ignores delete requests for URLs it did not create", async () => {
      await expect(images.deleteProductImage("/etc/passwd")).resolves.toBeUndefined();
      await expect(images.deleteProductImage("/uploads/products/../../.env")).resolves.toBeUndefined();
      await expect(images.deleteProductImage(null)).resolves.toBeUndefined();
    });
  });
}

suite("local driver", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ghaltak-images-"));
  return {
    env: { STORAGE_DRIVER: "local", UPLOAD_DIR: root },
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
});

suite("s3 driver", async () => {
  const s3 = await startTestS3();
  return { env: s3Env(s3.config), config: s3.config, cleanup: s3.close };
});

describe("when the S3 service is down", () => {
  let images: ImageStorage;
  let saved: { ok: true; url: string };

  beforeAll(async () => {
    const s3 = await startTestS3();
    images = await loadWith(s3Env(s3.config));
    const result = await images.saveProductImage(file(PNG));
    if (!result.ok) throw new Error(result.error);
    saved = result;
    await s3.close(); // the service goes away
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("saving returns a form error instead of crashing the request", async () => {
    expect(await images.saveProductImage(file(PNG))).toEqual({
      ok: false,
      error: expect.stringContaining("دوباره"),
    });
  });

  it("deleting only logs: the product change already committed", async () => {
    await expect(images.deleteProductImage(saved.url)).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});
