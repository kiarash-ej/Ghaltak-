import "dotenv/config";
import path from "node:path";
import {
  driverFromEnv,
  localStorageRoot,
  storageDriverName,
} from "../src/server/storage/config";
import { copyFolderToStorage } from "../src/server/storage/copy-folder";

// One-time move of Phase 1 product images from the local uploads folder into
// the configured storage (A7). Run it once on the server after setting the S3
// variables, before switching STORAGE_DRIVER=s3 for the running app:
//
//   STORAGE_DRIVER=s3 npm run storage:migrate-products -- --from ./uploads
//
// Source files are never deleted, and running it twice is harmless.
// Image URLs in the database do not change, so nothing else needs migrating.

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const sourceRoot = path.resolve(argValue("--from") ?? "uploads");
  const driverName = storageDriverName();

  if (driverName === "local" && localStorageRoot() === sourceRoot) {
    console.log(
      `STORAGE_DRIVER=local already reads from ${sourceRoot}; there is nothing to move. ` +
        "Set STORAGE_DRIVER=s3 and the S3_* variables first.",
    );
    return;
  }

  console.log(`Copying ${path.join(sourceRoot, "products")} → storage (${driverName}, public bucket)…`);
  const report = await copyFolderToStorage({
    sourceRoot,
    folder: "products",
    bucket: "public",
    to: driverFromEnv(),
  });

  for (const s of report.skipped) console.log(`  skipped ${s.name}: ${s.reason}`);
  console.log(`Done: ${report.copied.length} copied, ${report.skipped.length} skipped.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
