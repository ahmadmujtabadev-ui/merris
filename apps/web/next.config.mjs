/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@merris/shared'],
  async rewrites() {
    // In local dev, proxy /api/* to the local backend to avoid CORS and env var setup.
    // In production this is a no-op because NEXT_PUBLIC_API_URL is set to the real backend.
    if (process.env.NODE_ENV === 'production') return [];
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ];
  },
};

export default nextConfig;
