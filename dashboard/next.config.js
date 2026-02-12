/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['cdn.discordapp.com'],
  },
  allowedDevOrigins: ['*'],
  async rewrites() {
    if (process.env.NODE_ENV === 'production') {
      return [];
    }
    return [
      {
        source: '/admin/:path*',
        destination: 'http://localhost:3001/admin/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
