/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['cdn.discordapp.com'],
  },
  allowedDevOrigins: [
    '5298c165-ac5e-4b78-885d-30d78914b3b6-00-2vs63sqy2cwxv.kirk.replit.dev',
    'localhost',
  ],
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
