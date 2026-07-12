import Image from 'next/image';

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
      {withWordmark ? <BrandFull size={size} /> : <BrandMark size={size} />}
      {withWordmark && suffix ? (
        <span className="text-base font-semibold text-neutral-dark font-display leading-none">
          <span className="text-neutral-mid font-medium"> {suffix}</span>
        </span>
      ) : null}
    </span>
  );
}

export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <>
      <Image
        src="/expyrico-logo-mark.png"
        width={size}
        height={size}
        alt="Expyrico"
        className={`dark:hidden ${className ?? ''}`}
        style={{ width: size, height: size, objectFit: 'contain' }}
      />
      <Image
        src="/expyrico-logo-mark-dark.png"
        width={size}
        height={size}
        alt="Expyrico"
        className={`hidden dark:inline-block ${className ?? ''}`}
        style={{ width: size, height: size, objectFit: 'contain' }}
      />
    </>
  );
}

function BrandFull({ size = 32 }: { size?: number }) {
  return (
    <>
      <Image
        src="/expyrico-logo-full.png"
        width={Math.round(size * 2.8125)}
        height={size}
        alt="Expyrico"
        className="dark:hidden"
        style={{ width: size * 2.8125, height: size, objectFit: 'contain' }}
      />
      <Image
        src="/expyrico-logo-full-dark.png"
        width={Math.round(size * 2.8125)}
        height={size}
        alt="Expyrico"
        className="hidden dark:inline-block"
        style={{ width: size * 2.8125, height: size, objectFit: 'contain' }}
      />
    </>
  );
}
