/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paypal: { DEFAULT: '#0070BA', dark: '#003087', light: '#E8F2FA' },
      },
    },
  },
  plugins: [],
}
