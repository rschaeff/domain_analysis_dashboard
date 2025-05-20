/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Add webpack configuration for 3DMol.js compatibility
  webpack: (config) => {
    // This helps with libraries that use 'canvas'
    config.externals = [...(config.externals || []), { canvas: 'canvas' }];
    return config;
  },

  // Configure proper experimental features
  experimental: {
    // Enable App Router features if needed
    appDir: true,
    // Improve compatibility with external libraries
    esmExternals: 'loose',
    // For Turbopack specific settings
    turbo: {
      // Resolve aliases for browser-only modules
      resolveAlias: {
        // Add any specific module resolutions if needed
      }
    }
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
        // Updated Content Security Policy headers to support 3DMol.js
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Allow unsafe-eval needed for 3DMol.js WebGL
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              // Expanded img-src to support data URIs from 3DMol screenshots
              "img-src 'self' data: https: blob:",
              // Allow connect-src to fetch PDB files from external sources
              "connect-src 'self' https://files.rcsb.org https://www.ebi.ac.uk"
            ].join('; ')
          }
        ]
      }
    ]
  },
}

export default nextConfig
