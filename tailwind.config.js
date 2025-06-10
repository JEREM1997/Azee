/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'krispy-green': {
          DEFAULT: '#046A38',
          light: '#057940',
          dark: '#035C30'
        },
        'krispy-red': {
          DEFAULT: '#C8102E',
          light: '#DE1232',
          dark: '#B00E28'
        }
      }
    },
  },
  plugins: [],
};