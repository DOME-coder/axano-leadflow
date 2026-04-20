import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        axano: {
          primaer: '#1a2b4c',
          sekundaer: '#2f3542',
          graphit: '#3f4e65',
          'sky-blue': '#c7d7e8',
          'soft-cloud': '#f5f7fa',
          orange: '#ff8049',
          'orange-tief': '#ea6c37',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
      },
      fontFeatureSettings: {
        zahl: "'tnum' 1, 'cv08' 1",
      },
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
      },
      boxShadow: {
        // Corporate-tinted Shadows – referenzieren CSS-Variablen
        'ax-xs': 'var(--schatten-xs)',
        'ax-sm': 'var(--schatten-sm)',
        'ax-md': 'var(--schatten-md)',
        'ax-lg': 'var(--schatten-lg)',
        'ax-xl': 'var(--schatten-xl)',
        'ax-fokus': 'var(--schatten-fokus)',
        'ax-innen': 'var(--schatten-innen)',
      },
      transitionTimingFunction: {
        sanft: 'cubic-bezier(0.32, 0.72, 0, 1)',
        feder: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        schnell: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      transitionDuration: {
        250: '250ms',
        350: '350ms',
      },
      keyframes: {
        einblenden: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'einblenden-nach-oben': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'einblenden-von-rechts': {
          from: { opacity: '0', transform: 'translateX(16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'puls-sanft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'schimmern-orange': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255, 128, 73, 0.4)' },
          '50%': { boxShadow: '0 0 0 6px rgba(255, 128, 73, 0)' },
        },
        schimmern: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        einblenden: 'einblenden 200ms cubic-bezier(0.32, 0.72, 0, 1)',
        'einblenden-nach-oben': 'einblenden-nach-oben 260ms cubic-bezier(0.32, 0.72, 0, 1)',
        'einblenden-von-rechts': 'einblenden-von-rechts 280ms cubic-bezier(0.32, 0.72, 0, 1)',
        'puls-sanft': 'puls-sanft 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'schimmern-orange': 'schimmern-orange 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        schimmern: 'schimmern 1.5s infinite',
      },
      backgroundImage: {
        'gradient-primaer': 'linear-gradient(135deg, #1a2b4c 0%, #243d6f 100%)',
        'gradient-orange': 'linear-gradient(180deg, #ff8049 0%, #ea6c37 100%)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
