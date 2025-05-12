import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/verify",
        destination: "http://localhost:8000/verify",
      },
    ];
  },
};

export default nextConfig;
