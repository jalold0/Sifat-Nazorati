import type { Config } from 'tailwindcss';

/**
 * Dizayn tokenlari CSS o'zgaruvchilariga bog'langan (globals.css) —
 * shuning uchun yorug'/qorong'i rejim bitta joydan boshqariladi.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // rgb(<kanallar> / <alpha-value>) — bu shakl `bg-brand/12` kabi
      // shaffoflik modifikatorlarini ishlashiga imkon beradi
      colors: {
        plane: 'rgb(var(--plane-rgb) / <alpha-value>)',
        surface: 'rgb(var(--surface-rgb) / <alpha-value>)',
        raised: 'rgb(var(--raised-rgb) / <alpha-value>)',
        ink: 'rgb(var(--ink-rgb) / <alpha-value>)',
        ink2: 'rgb(var(--ink2-rgb) / <alpha-value>)',
        muted: 'rgb(var(--muted-rgb) / <alpha-value>)',
        line: 'rgb(var(--line-rgb) / <alpha-value>)',
        grid: 'rgb(var(--grid-rgb) / <alpha-value>)',
        brand: 'rgb(var(--brand-rgb) / <alpha-value>)',
        accent: 'rgb(var(--accent-rgb) / <alpha-value>)',
        ok: 'rgb(var(--ok-rgb) / <alpha-value>)',
        warn: 'rgb(var(--warn-rgb) / <alpha-value>)',
        bad: 'rgb(var(--bad-rgb) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        card: '16px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,11,11,.04), 0 8px 24px -12px rgba(11,11,11,.10)',
      },
    },
  },
  plugins: [],
};

export default config;
