/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', 'monospace'],
      },
      colors: {
        // Custom color schemes for domain analysis
        confidence: {
          high: '#10b981',    // green-500
          medium: '#f59e0b',  // amber-500
          low: '#ef4444',     // red-500
        },
        boundary: {
          putative: '#3b82f6',   // blue-500
          reference: '#ef4444',  // red-500
          overlap: '#8b5cf6',    // violet-500
          conflict: '#f59e0b',   // amber-500
        },
        classification: {
          't-group': '#3b82f6',  // blue-500
          'h-group': '#10b981',  // emerald-500
          'x-group': '#8b5cf6',  // violet-500
          'a-group': '#f59e0b',  // amber-500
        },
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
      },
    },
  },
  plugins: [],
};
