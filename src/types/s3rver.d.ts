// s3rver ships no types. Only what src/test/s3.ts uses: an in-process
// S3-compatible server for testing the s3 storage driver.
declare module "s3rver" {
  type S3rverOptions = {
    port?: number;
    address?: string;
    silent?: boolean;
    directory: string;
    configureBuckets?: { name: string }[];
  };

  export default class S3rver {
    constructor(options: S3rverOptions);
    run(): Promise<{ address: string; port: number }>;
    close(): Promise<void>;
  }
}
