// TypeScript mirror of the CSS variables in globals.css.
// Use these when a component needs inline styles (e.g., SVG fills, runtime-computed colors).
// For static styling, prefer Tailwind utility classes.

export const merrisTokens = {
  bg: '#f8f9fa',
  surface: '#ffffff',
  surfaceLow: '#f3f4f5',
  surfaceHigh: '#edeef0',
  text: '#191c1d',
  textSecondary: '#5f6368',
  textTertiary: '#9aa0a6',
  primary: '#006b5f',
  primaryLight: '#2dd4bf',
  primaryBg: '#e0f5f1',
  warning: '#d97706',
  warningBg: '#fff7ed',
  error: '#dc2626',
  errorBg: '#fef2f2',
  success: '#16a34a',
  successBg: '#f0fdf4',
  border: 'rgba(0, 107, 95, 0.08)',
  borderMedium: 'rgba(0, 107, 95, 0.15)',
  shadow: '0 1px 3px rgba(0,0,0,.04),0 4px 12px rgba(0,0,0,.03)',
  shadowHover: '0 4px 24px rgba(0,0,0,.06)',
  radius: '12px',
  radiusSm: '8px',
  fontDisplay: "'Manrope', sans-serif",
  fontBody: "'Inter', sans-serif",
} as const;

export type MerrisTokens = typeof merrisTokens;
