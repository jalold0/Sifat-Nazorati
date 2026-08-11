import type { Config } from 'tailwindcss';

/**
 * Dizayn tokenlari.
 *
 * Ranglar CSS o'zgaruvchilariga bog'langan (globals.css) — yorug'/qorong'i rejim
 * bitta joydan boshqariladi. `rgb(<kanallar> / <alpha-value>)` shakli `bg-brand/12`
 * kabi shaffoflik modifikatorlarini ishlashiga imkon beradi.
 *
 * Tipografiya — ma'lumot zich ekranlar uchun tanlangan aniq shkala.
 * Sahifalarda `text-[13.5px]` kabi tarqoq qiymatlar ishlatilmaydi: har bir
 * o'lcham nomi bilan chaqiriladi, shuning uchun ierarxiya butun tizimda bir xil.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
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

      fontSize: {
        // Sahifa sarlavhasi
        display: ['30px', { lineHeight: '1.16', letterSpacing: '-0.025em', fontWeight: '650' }],
        // Kartochka sarlavhasi
        title: ['16.5px', { lineHeight: '1.3', letterSpacing: '-0.012em', fontWeight: '600' }],
        // Katta raqamlar (StatTile, gauge)
        stat: ['27px', { lineHeight: '1', letterSpacing: '-0.03em', fontWeight: '650' }],
        'stat-lg': ['42px', { lineHeight: '1', letterSpacing: '-0.035em', fontWeight: '660' }],
        // Asosiy matn va jadval katagi
        body: ['13.5px', { lineHeight: '1.55' }],
        // Ikkinchi darajali matn, izohlar
        meta: ['12.5px', { lineHeight: '1.45' }],
        // Jadval sarlavhasi, eyebrow — har doim uppercase
        label: ['11px', { lineHeight: '1.35', letterSpacing: '0.07em', fontWeight: '600' }],
        // Eng kichik yordamchi matn
        micro: ['11.5px', { lineHeight: '1.4' }],
      },

      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },

      // Vertikal ritm — sahifa bo'limlari orasidagi masofa bir xil bo'lishi uchun
      spacing: {
        section: '18px',
        card: '20px',
        'card-lg': '24px',
      },

      borderRadius: {
        card: '14px',
        tile: '11px',
      },

      boxShadow: {
        card: '0 1px 2px rgb(var(--ink-rgb) / 0.04)',
        raised: '0 1px 2px rgb(var(--ink-rgb) / 0.05), 0 8px 20px -12px rgb(var(--ink-rgb) / 0.12)',
      },

      transitionDuration: {
        DEFAULT: '150ms',
      },
    },
  },
  plugins: [],
};

export default config;
