import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Product images and store logos share one public-image store, each in its
// own folder. (Both drivers are covered in catalog/image-storage.test.ts.)

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9]);
const file = () => new File([PNG], "logo.png", { type: "image/png" });

describe("public image folders", () => {
  let root: string;
  let mod: typeof import("./public-images");

  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), "ghaltak-public-"));
    vi.resetModules();
    vi.stubEnv("STORAGE_DRIVER", "local");
    vi.stubEnv("UPLOAD_DIR", root);
    mod = await import("./public-images");
  });
  afterAll(async () => {
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  });

  it("keeps logos and product images apart", async () => {
    const logos = mod.publicImages("logos");
    const products = mod.publicImages("products");

    const saved = await logos.save(file());
    if (!saved.ok) throw new Error(saved.error);
    expect(saved.url).toMatch(/^\/uploads\/logos\/[0-9a-f-]{36}\.png$/);
    const name = saved.url.split("/").pop()!;

    expect(await logos.read(name)).not.toBeNull();
    expect(await products.read(name)).toBeNull();

    await products.remove(saved.url); // not a product URL: ignored
    expect(await logos.read(name)).not.toBeNull();
    await logos.remove(saved.url);
    expect(await logos.read(name)).toBeNull();
  });

  it("serves an image with safe headers, and 404 for a missing one", async () => {
    const ok = mod.publicImageResponse({ body: Buffer.from(PNG), contentType: "image/png" });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("image/png");
    expect(ok.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await ok.arrayBuffer())).toEqual(PNG);

    expect(mod.publicImageResponse(null).status).toBe(404);
  });
});
