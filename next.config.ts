import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: "build",
  experimental: {
    workerThreads: process.env.CI ? false : undefined,
    cpus: process.env.CI ? 1 : undefined,
  },
};

export default nextConfig;
