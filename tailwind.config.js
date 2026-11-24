/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        slate: {
          50: '#F7F8F5',
          100: '#EEF1EC',
          200: '#E3E8E1',
          300: '#D1D9D0',
          400: '#9AA79D',
          500: '#718075',
          600: '#58665C',
          700: '#3D4B42',
          800: '#26352C',
          900: '#17231E',
          950: '#101A15',
        },
        brand: {
          50: '#F1F6F1',
          100: '#E5F0E6',
          200: '#C9DEC9',
          300: '#A8C9AE',
          400: '#7EAE8C',
          500: '#4E956C',
          600: '#2F704D',
          700: '#214D37',
          800: '#193D2C',
          900: '#172F24',
          950: '#102219',
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"DM Sans"', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['"DM Serif Display"', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(23,35,30,.04), 0 1px 3px rgba(23,35,30,.05)',
        lift: '0 8px 24px -6px rgba(23,35,30,.12)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up .4s ease-out both',
        shimmer: 'shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
};
