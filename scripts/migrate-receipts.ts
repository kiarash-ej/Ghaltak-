import "dotenv/config";
import path from "node:path";
import {
  driverFromEnv,
  localStorageRoot,
  storageDriverName,
} from "../src/server/storage/config";
import { copyFolderToStorage } from "../src/server/storage/copy-folder";

// One-time move of Phase 1 payment receipts from the local uploads folder into
// the configured storage's PRIVATE bucket (B6). Run it once on the server
// after setting the S3 variables, before switching STORAGE_DRIVER=s3 for the
// running app (docs/phase2/TRACK-C.md, C1):
//
//   STORAGE_DRIVER=s3 npm run storage:migrate-receipts -- --from ./uploads
//
// Source files are never deleted, and running it twice is harmless. The keys
// in Order.receiptImageUrl ("receipts/<uuid>.<ext>") do not change.

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const sourceRoot = path.resolve(argValue("--from") ?? "uploads");
  const driverName = storageDriverName();

  if (driverName === "local" && localStorageRoot() === sourceRoot) {
    console.log(
      `STORAGE_DRIVER=local already reads receipts from ${sourceRoot}; there is nothing to move. ` +
        "Set STORAGE_DRIVER=s3 and the S3_* variables first.",
    );
    return;
  }

  console.log(`Copying ${path.join(sourceRoot, "receipts")} → storage (${driverName}, private bucket)…`);
  const report = await copyFolderToStorage({
    sourceRoot,
    folder: "receipts",
    bucket: "private",
    to: driverFromEnv(),
  });

  for (const s of report.skipped) console.log(`  skipped ${s.name}: ${s.reason}`);
  console.log(`Done: ${report.copied.length} copied, ${report.skipped.length} skipped.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
