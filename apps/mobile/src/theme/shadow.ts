export type RNShadowProps = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};

const PX = (s: string) => Number.parseFloat(s.replace('px', ''));

export function parseShadow(css: string): RNShadowProps {
  // Tokenise on whitespace, but keep rgba(...) / hsl(...) etc. intact.
  const parts: string[] = [];
  let buf = '';
  let depth = 0;
  for (const ch of css.trim()) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ' ' && depth === 0) {
      if (buf) parts.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf) parts.push(buf);

  // Forms supported:
  //   "x y blur color"           (4 parts)
  //   "x y blur color opacity"   (5 parts, opacity overrides)
  const x = PX(parts[0] ?? '0');
  const y = PX(parts[1] ?? '0');
  const blur = PX(parts[2] ?? '0');
  const color = parts[3] ?? 'rgba(0,0,0,0.1)';
  const opacity = parts[4] ? Number.parseFloat(parts[4]) : 1;

  return {
    shadowColor: color,
    shadowOffset: { width: x, height: y },
    shadowOpacity: opacity,
    shadowRadius: blur,
    elevation: Math.max(2, Math.round(blur / 2)),
  };
}
