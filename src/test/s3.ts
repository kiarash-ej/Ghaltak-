import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import S3rver from "s3rver";
import type { S3Config } from "@/server/storage/drivers";

// A real S3-compatible server inside the test process (s3rver), so the s3
// driver is tested without MinIO, Docker or the internet.

export async function startTestS3(
  buckets: S3Config["buckets"] = { public: "ghaltak-public", private: "ghaltak-private" },
): Promise<{ config: S3Config; close: () => Promise<void> }> {
  const dir = await mkdtemp(path.join(tmpdir(), "ghaltak-s3-"));
  const server = new S3rver({
    port: 0,
    address: "127.0.0.1",
    silent: true,
    directory: dir,
    configureBuckets: [{ name: buckets.public }, { name: buckets.private }],
  });
  const { port } = await server.run();
  return {
    config: {
      endpoint: `http://127.0.0.1:${port}`,
      region: "us-east-1",
      accessKeyId: "S3RVER", // s3rver's fixed test credentials
      secretAccessKey: "S3RVER",
      buckets,
    },
    close: async () => {
      await server.close();
      await rm(dir, { recursive: true, force: true });
    },
  };
}
