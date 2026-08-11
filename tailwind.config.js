export default {
  content: [
    './index.html',
    './**/*.{js,jsx,ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          950: '#0a0a0a',
          900: '#111111',
          800: '#1a1a1a',
        },
        premium: {
          cream: '#FDFBF7',
          gold: '#D4AF37',
          royal: '#1E3A8A',
          charcoal: '#333333',
        },
      },
      boxShadow: {
        deep: '0 16px 40px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
};
