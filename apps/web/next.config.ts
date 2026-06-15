import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@souschef/shared", "@souschef/ui"],
};

export default nextConfig;
