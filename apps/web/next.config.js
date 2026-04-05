/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@rayalaseema/ui", "@rayalaseema/db"],
  images: {
    domains: ["res.cloudinary.com", "localhost"],
  },
};

module.exports = nextConfig;
