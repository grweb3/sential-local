/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        orbitron: ['Orbitron', 'sans-serif'],
        opensans: ['Open Sans', 'sans-serif'],
      },
      colors: {
        brand: {
          black: '#0A100D',
          dark: '#13111C', // The deep purple background from the mockup
          purple: '#6C63FF',
          cyan: '#00D4FF',
          gold: {
            100: '#F7EF8A', // 50% stop
            200: '#EDC967', // 100% stop
            300: '#D2AC47', // 75% stop
            400: '#AE8645', // 0% stop
          }
        }
      },
    backgroundImage: {
        'cyber-grid': `radial-gradient(circle at 50% 0%, #6c63ff30 0%, transparent 50%), linear-gradient(to right, rgba(108, 99, 255, 0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(108, 99, 255, 0.1) 1px, transparent 1px)`,
        // Your exact gradient stops from the design specs:
        'grad-gold': 'linear-gradient(90deg, #AE8645 0%, #F7EF8A 50%, #D2AC47 75%, #EDC967 100%)',
        'grad-cyan-purple': 'linear-gradient(90deg, #00D4FF 0%, #6C63FF 100%)',
      }
    },
  },
  plugins: [],
}