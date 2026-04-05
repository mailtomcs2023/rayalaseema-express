/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@rayalaseema/ui", "@rayalaseema/db"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "http", hostname: "localhost" },
    ],
  },
};

module.exports = nextConfig;
