import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Демки CS2 весят десятки МБ — увеличиваем лимит для Server Actions
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
};

export default nextConfig;
