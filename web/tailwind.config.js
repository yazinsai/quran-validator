/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Crimson Pro', 'Georgia', 'serif'],
        arabic: ['Amiri', 'serif'],
      },
      colors: {
        cream: {
          DEFAULT: '#faf8f5',
          dark: '#f5f2ec',
        },
        sand: '#e8e4dc',
        sage: {
          DEFAULT: '#5a7a6b',
          light: '#7a9a8b',
          dark: '#4a6a5b',
        },
        terracotta: {
          DEFAULT: '#c67b5c',
          light: '#d69b7c',
        },
        charcoal: {
          DEFAULT: '#2d3436',
          light: '#636e72',
          muted: '#9aa0a6',
        },
      },
      boxShadow: {
        'soft': '0 2px 8px -2px rgba(45, 52, 54, 0.08)',
        'soft-lg': '0 4px 16px -4px rgba(45, 52, 54, 0.1)',
        'soft-xl': '0 8px 24px -8px rgba(45, 52, 54, 0.12)',
      },
    },
  },
  plugins: [],
};
