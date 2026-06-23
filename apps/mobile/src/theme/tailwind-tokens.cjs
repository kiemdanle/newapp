// Plain CommonJS so tailwind.config.js can require() it without a TS transpiler.
// Expyrico brand palette (spec §2.10) — the build-time baseline. Runtime theme
// switching is handled by the theme provider via context, so this is only the
// static baseline that NativeWind compiles against.
const tailwindTokens = {
  colors: {
    bg: '#FAFAF8',
    'bg-elevated': '#FFFFFF',
    'bg-glass': '#D6F0E6',
    border: '#F0F0ED',
    fg: '#2C2C28',
    'fg-muted': '#8C8C85',
    primary: '#4BAE8A',
    'primary-fg': '#FFFFFF',
    'primary-dark': '#3A8F6F',
    'primary-light': '#D6F0E6',
    accent: '#F5A623',
    'accent-light': '#FEEFC3',
    'neutral-light': '#F0F0ED',
    'neutral-mid': '#8C8C85',
    'neutral-dark': '#2C2C28',
    success: '#4BAE8A',
    warning: '#F5A623',
    danger: '#E0442A',
    good: '#4BAE8A',
    'expiring-soon': '#F5A623',
    expired: '#E0442A',
  },
  borderRadius: {
    sm: '10px',
    md: '16px',
    lg: '22px',
    xl: '30px',
    pill: '999px',
  },
};

module.exports = { tailwindTokens };
