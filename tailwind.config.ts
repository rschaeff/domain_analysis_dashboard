import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Domain boundary visualization colors
        boundary: {
          'putative': '#3b82f6',
          'reference': '#ef4444',
          'overlap': '#8b5cf6',
          'conflict': '#f59e0b',
        },
        // Classification group colors
        classification: {
          't-group': '#10b981',
          'h-group': '#f59e0b',
          'x-group': '#ef4444',
          'a-group': '#8b5cf6',
        },
        // Evidence confidence colors
        confidence: {
          'high': '#10b981',
          'medium': '#f59e0b',
          'low': '#ef4444',
          'none': '#6b7280',
        }
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      }
    },
  },
  plugins: [],
}
export default config
