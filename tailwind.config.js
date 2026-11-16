/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { display: ['"Inter"', 'system-ui', 'sans-serif'] },
      colors: { sky: { glow: '#9fd8ff' }, ember: '#ffb347' },
    },
  },
  plugins: [],
};
