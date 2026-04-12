/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0a0a0d',
          soft: '#111217',
          card: '#16181f',
          elevated: '#1c1f28',
          border: '#262a36',
        },
        accent: {
          DEFAULT: '#3b82f6',
          hover: '#2563eb',
          soft: '#1e40af',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
