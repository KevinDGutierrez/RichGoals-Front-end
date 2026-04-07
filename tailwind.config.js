/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aura: {
          bg: '#000000',
          card: '#0A0A0A',
          border: '#1A1A1A',
          primary: '#00FFC4',
          secondary: '#7000FF',
          text: '#FFFFFF',
          muted: '#8A8A8A'
        }
      }
    },
  },
  plugins: [],
}
