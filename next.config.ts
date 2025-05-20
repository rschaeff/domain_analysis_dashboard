/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Turbopack configuration (moved from experimental.turbo)
  turbopack: {
    // Any Turbopack-specific options
  },

  // Allow cross-origin requests during development
  experimental: {
    // Add allowed origins for development
    allowedDevOrigins: ['lotta.swmed.edu'],
  },

  // Headers configuration
  async headers() {
    return [
      {
        // API CORS headers
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
      {
        // Content Security Policy headers with PDB data sources
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              "img-src 'self' data: https: blob:",
              "connect-src 'self' https://files.rcsb.org https://www.ebi.ac.uk"
            ].join('; ')
          }
        ]
      }
    ]
  },
}

export default nextConfig
