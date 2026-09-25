import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { sniffImageType } from "../catalog/image-type";
import type { StorageDriver } from "./drivers";
import { CONTENT_TYPES, isValidKey, type Bucket } from "./keys";

// Copies the files of one Phase 1 upload folder (e.g. uploads/products) into
// the storage, for the one-time move to S3 (scripts/migrate-product-images.ts).
//
// - Never deletes or changes the source files: they stay as a backup.
// - Safe to run again: keys are the same file names, so a rerun rewrites the
//   same objects with the same bytes.
// - Every copy is read back and compared before it counts as copied.

export type CopyReport = {
  copied: string[];
  skipped: { name: string; reason: string }[];
};

export async function copyFolderToStorage(opts: {
  /** The old uploads root, e.g. "./uploads". */
  sourceRoot: string;
  folder: "products" | "logos" | "receipts";
  bucket: Bucket;
  to: StorageDriver;
}): Promise<CopyReport> {
  const dir = path.join(opts.sourceRoot, opts.folder);
  const report: CopyReport = { copied: [], skipped: [] };

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return report;
    throw err;
  }

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const name = entry.name;
    const key = `${opts.folder}/${name}`;
    if (!entry.isFile()) {
      report.skipped.push({ name, reason: "not a file" });
      continue;
    }
    if (!isValidKey(key)) {
      report.skipped.push({ name, reason: "not a <uuid>.<jpg|png|webp> name" });
      continue;
    }
    const bytes = new Uint8Array(await readFile(path.join(dir, name)));
    const ext = sniffImageType(bytes);
    if (!ext || !name.endsWith(`.${ext}`)) {
      report.skipped.push({ name, reason: "content is not the image type its name says" });
      continue;
    }

    await opts.to.put(opts.bucket, key, bytes, CONTENT_TYPES[ext]);
    const back = await opts.to.get(opts.bucket, key);
    if (!back || !Buffer.from(bytes).equals(back.body)) {
      throw new Error(`Copy of ${key} did not read back identical; stopping.`);
    }
    report.copied.push(name);
  }
  return report;
}
