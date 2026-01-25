/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Couleurs du thème MANSA'A AFRICA
        'theme': {
          'yellow': '#fdd21d',
          'orange': '#ea580c',
          'brown': '#773619',
          'beige': '#e2b069',
          'forest': '#183524',
          'gray': '#b9b5ae',
          'olive': '#7e9a63',
        },
        // Palette Emerald/Indigo (conservée)
        emerald: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
        indigo: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
      },
      fontFamily: {
        // Polices personnalisées du dossier public/fonts
        'tan-mon-cheri': ['Tan Mon Cheri', 'Playfair Display', 'Georgia', 'serif'],
        'allura': ['Allura', 'Brush Script MT', 'cursive'],
        'lemon-milk': ['Lemon Milk', 'Inter', 'Helvetica Neue', 'Arial', 'sans-serif'],
        'libre-baskerville': ['Libre Baskerville', 'Georgia', 'Times New Roman', 'serif'],
        
        // Police système par défaut
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};