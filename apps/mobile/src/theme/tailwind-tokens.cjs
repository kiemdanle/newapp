// Plain CommonJS so tailwind.config.js can require() it without a TS transpiler.
// These are the Aurora Glass token values (the build-time default palette).
// Keep in sync with @expyrico/theme's `aurora` export; runtime theme switching is
// handled by the theme provider via context, so this is only the static baseline.
const tailwindTokens = {
  colors: {
    bg: '#0b0a17',
    'bg-elevated': 'rgba(255,255,255,0.06)',
    'bg-glass': 'rgba(255,255,255,0.08)',
    border: 'rgba(255,255,255,0.12)',
    fg: '#fafafa',
    'fg-muted': 'rgba(250,250,250,0.7)',
    primary: '#a855f7',
    'primary-fg': '#ffffff',
    accent: '#a5f3fc',
    success: '#86efac',
    warning: '#fbbf24',
    danger: '#fb7185',
  },
  borderRadius: {
    sm: '8px',
    md: '14px',
    lg: '20px',
    xl: '28px',
    pill: '999px',
  },
};

module.exports = { tailwindTokens };
