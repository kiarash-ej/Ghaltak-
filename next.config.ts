import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1MB. Product photos (max 2MB, see image-storage.ts) are sent
      // through a Server Action together with the form fields.
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
