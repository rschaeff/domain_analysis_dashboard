/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable experimental features if needed
  experimental: {
    // serverActions: true,
  },

  // Configure image domains if using next/image with external sources
  images: {
    domains: [
      // Add domains for any external images
      'www.ebi.ac.uk',
      'molstar.org',
    ],
  },

  // Environment variables available at build time
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // Rewrites for API proxying if needed
  async rewrites() {
    return [
      // Add any URL rewrites here
    ]
  },

  // Headers for CORS if needed for external integrations
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*', // Adjust as needed for security
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
