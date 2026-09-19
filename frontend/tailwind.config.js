/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        prozen: {
          dark: '#0b132a',      // Sidebar primary dark navy
          navbg: '#0f172a',     // Navigation section bg
          hover: '#1e293b',     // Item hover state
          active: '#2563eb',    // Active blue navigation state
          light: '#f8fafc',     // Main background
          card: '#ffffff',      // Card white bg
          border: '#e2e8f0',    // Clean subtle border
          textMuted: '#94a3b8', // Muted nav text
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
