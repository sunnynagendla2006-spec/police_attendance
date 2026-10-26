/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        police: {
          bg: '#F5F7FA',
          card: '#FFFFFF',
          navy: '#17365D',
          navyDark: '#0F243E',
          navyLight: '#EBF2FA',
          blue: '#2563EB',
          text: '#172B4D',
          muted: '#64748B',
          border: '#E2E8F0',
          success: '#15803D',
          warning: '#B45309',
          danger: '#B91C1C',
          slate: '#334155'
        }
      }
    },
  },
  plugins: [],
}
