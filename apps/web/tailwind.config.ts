import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Context Layer brand palette (from RevOps consulting workspace)
        teal: {
          DEFAULT: '#1a9988',
          50: '#f0faf9',
          500: '#1a9988',
          600: '#157d6f',
          700: '#106058',
        },
        navy: {
          DEFAULT: '#073763',
          500: '#073763',
          600: '#052c50',
          700: '#031d35',
        },
        orange: {
          DEFAULT: '#eb5600',
          500: '#eb5600',
          600: '#c44900',
        },
        cream: '#fff5d9',
      },
      fontFamily: {
        sans: ['var(--font-raleway)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
