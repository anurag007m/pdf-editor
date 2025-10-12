/**
 * Tailwind CSS configuration for the PDF Editor app.
 * Scans index.html and all files in src/ for class usage.
 */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#2563eb',
          light: '#60a5fa',
          dark: '#1e40af',
        },
      },
      boxShadow: {
        soft: '0 2px 10px rgba(0,0,0,0.05)',
      },
    },
  },
  plugins: [],
};