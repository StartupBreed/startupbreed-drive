/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow uploads up to 50MB (default is 4MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
