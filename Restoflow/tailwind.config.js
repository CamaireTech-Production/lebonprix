/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#000000',
          dark: '#111111',
          light: '#222222',
        },
        secondary: '#FFFFFF',
        accent: '#FFD700',
        rose: '#8B0000',
        background: '#111111',
        sidebarBackground: '#1E1E1E',
        success: '#4CAF50',
      },
    },
  },
  plugins: [],
};
