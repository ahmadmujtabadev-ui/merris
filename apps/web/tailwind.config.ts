import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        merris: {
          bg: 'var(--merris-bg)',
          surface: 'var(--merris-surface)',
          'surface-low': 'var(--merris-surface-low)',
          'surface-high': 'var(--merris-surface-high)',
          text: 'var(--merris-text)',
          'text-secondary': 'var(--merris-text-secondary)',
          'text-tertiary': 'var(--merris-text-tertiary)',
          primary: 'var(--merris-primary)',
          'primary-light': 'var(--merris-primary-light)',
          'primary-bg': 'var(--merris-primary-bg)',
          warning: 'var(--merris-warning)',
          'warning-bg': 'var(--merris-warning-bg)',
          error: 'var(--merris-error)',
          'error-bg': 'var(--merris-error-bg)',
          success: 'var(--merris-success)',
          'success-bg': 'var(--merris-success-bg)',
          border: 'var(--merris-border)',
          'border-medium': 'var(--merris-border-medium)',
        },
      },
      fontFamily: {
        display: ['var(--font-manrope)', 'Manrope', 'sans-serif'],
        body: ['var(--font-inter)', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        merris: 'var(--merris-radius)',
        'merris-sm': 'var(--merris-radius-sm)',
      },
      boxShadow: {
        merris: 'var(--merris-shadow)',
        'merris-hover': 'var(--merris-shadow-hover)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pulse-soft': {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'thinking-dot': {
          '0%,60%,100%': { transform: 'translateY(0)', opacity: '0.3' },
          '30%': { transform: 'translateY(-4px)', opacity: '1' },
        },
        'cursor-blink': {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'slide-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'pulse-soft': 'pulse-soft 1.6s ease-in-out infinite',
        'thinking-dot-1': 'thinking-dot 1.2s ease-in-out infinite',
        'thinking-dot-2': 'thinking-dot 1.2s ease-in-out 0.15s infinite',
        'thinking-dot-3': 'thinking-dot 1.2s ease-in-out 0.3s infinite',
        'cursor-blink': 'cursor-blink 0.9s ease-in-out infinite',
        'slide-in': 'slide-in 0.25s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
