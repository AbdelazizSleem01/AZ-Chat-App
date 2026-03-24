import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Avoid optimizer 400s for legacy/relative URLs and ensure Cloudinary works
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com'
      }
    ]
  }
};

export default nextConfig;
