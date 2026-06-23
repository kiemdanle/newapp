// apps/admin/src/components/logo.tsx
// Expyrico brand mark — inline SVG so it renders crisp at any size and needs
// no asset pipeline. Colors are the brand palette (spec §2.10): Fresh Sage
// tile, white "e" ring, Honey leaf sprout. The leaf sprout carries the
// "expiring soon" accent meaning.

type LogoProps = {
  size?: number;
  className?: string;
  /** Include the "expyrico" wordmark to the right of the mark. */
  withWordmark?: boolean;
  /** Wordmark suffix, e.g. "Admin". Rendered after the wordmark. */
  suffix?: string;
};

export function Logo({ size = 32, className, withWordmark = false, suffix }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <BrandMark size={size} />
      {withWordmark && (
        <span className="text-base font-semibold text-neutral-dark font-display leading-none">
          expyrico
          {suffix ? <span className="text-neutral-mid font-medium"> {suffix}</span> : null}
        </span>
      )}
    </span>
  );
}

export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      role="img"
      aria-label="Expyrico"
      className={className}
    >
      <defs>
        <linearGradient id="expyrico-sage" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#52BF99" />
          <stop offset="1" stopColor="#3A8F6F" />
        </linearGradient>
        <linearGradient id="expyrico-honey" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F8B73A" />
          <stop offset="1" stopColor="#F0971A" />
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" rx="226" ry="226" fill="url(#expyrico-sage)" />
      <rect width="1024" height="1024" rx="226" ry="226" fill="#FFFFFF" opacity="0.06" />
      <path
        d="M 360 360 A 232 232 0 1 0 360 664"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="98"
        strokeLinecap="round"
      />
      <path
        d="M 318 512 H 612"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="98"
        strokeLinecap="round"
      />
      <g transform="translate(648 470) rotate(-42)">
        <path
          d="M 0 -150 C 70 -95 70 95 0 150 C -70 95 -70 -95 0 -150 Z"
          fill="url(#expyrico-honey)"
        />
        <path
          d="M 0 -138 L 0 138"
          fill="none"
          stroke="#3A8F6F"
          strokeWidth="12"
          strokeLinecap="round"
          opacity="0.55"
        />
      </g>
    </svg>
  );
}
