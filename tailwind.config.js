/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Aptos', 'Aptos Display', 'Segoe UI', 'ui-sans-serif', 'system-ui', '-apple-system', 'Roboto', 'sans-serif'],
        mono: ['Aptos Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        brand: {
          50: '#F6EBFF',
          100: '#EBD5FF',
          200: '#D276FF',
          300: '#AF56E6',
          400: '#8D35C4',
          500: '#640096',
          600: '#3E1955',
          700: '#220039',
        },
      },
      boxShadow: {
        glow: '0 8px 30px -8px rgba(175,86,230,0.45)',
      },
    },
  },
  plugins: [],
};
