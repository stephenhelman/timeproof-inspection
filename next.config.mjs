/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        // Cloudflare R2 public bucket — used for inspection photos and profile images
        protocol: "https",
        hostname: "pub-6e74e4d1fc9944f897a58feb86eeff18.r2.dev",
      },
    ],
  },
};

export default nextConfig;
