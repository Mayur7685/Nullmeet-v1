import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
      };
    }
    config.externals = [
      ...(Array.isArray(config.externals) ? config.externals : []),
      "pino-pretty",
    ];
    return config;
  },
};

export default nextConfig;
