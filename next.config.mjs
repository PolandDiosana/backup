/** @type {import('next').NextConfig} */
const nextConfig = {
  // Raise the body size limit for API routes so large folder ZIPs
  // don't get rejected with "Request Entity Too Large" (413) before
  // they even reach our handler.
  experimental: {
    serverActions: {
      bodySizeLimit: '512mb',
    },
  },
};

export default nextConfig;
