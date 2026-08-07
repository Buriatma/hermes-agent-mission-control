import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Docker runtime builds as standalone
  images: {
    unoptimized: false,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
