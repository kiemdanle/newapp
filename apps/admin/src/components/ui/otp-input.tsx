'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  hasError?: boolean;
}

export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  autoFocus = true,
  className,
  hasError = false,
}: OtpInputProps) {
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = React.useState<number | null>(null);

  // Normalize digits into array of length
  const digits = React.useMemo(() => {
    const arr = new Array(length).fill('');
    const clean = value.replace(/\D/g, '').slice(0, length);
    for (let i = 0; i < clean.length; i++) {
      arr[i] = clean[i];
    }
    return arr;
  }, [value, length]);

  React.useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  const handleFocus = (index: number) => {
    setFocusedIndex(index);
    inputRefs.current[index]?.select();
  };

  const handleBlur = () => {
    setFocusedIndex(null);
  };

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    if (!val) {
      // Cleared
      const newDigits = [...digits];
      newDigits[index] = '';
      const newVal = newDigits.join('');
      onChange(newVal);
      return;
    }

    // Single digit typed
    const newDigits = [...digits];
    newDigits[index] = val.slice(-1);
    const newVal = newDigits.join('');
    onChange(newVal);

    if (index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newVal.length === length && onComplete) {
      onComplete(newVal);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Move to previous box if current is empty
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;

    onChange(pasted);
    const targetIndex = Math.min(pasted.length, length - 1);
    inputRefs.current[targetIndex]?.focus();

    if (pasted.length === length && onComplete) {
      onComplete(pasted);
    }
  };

  return (
    <div
      className={cn('flex items-center justify-between gap-2 sm:gap-2.5', className)}
      onPaste={handlePaste}
    >
      {Array.from({ length }).map((_, index) => {
        const digit = digits[index] || '';
        const isFocused = focusedIndex === index;
        const isFilled = Boolean(digit);

        return (
          <div key={index} className="relative flex-1">
            <input
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              maxLength={1}
              value={digit}
              disabled={disabled}
              aria-label={`Digit ${index + 1} of ${length}`}
              onFocus={() => handleFocus(index)}
              onBlur={handleBlur}
              onChange={(e) => handleChange(index, e)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className={cn(
                'flex h-13 sm:h-14 w-full items-center justify-center rounded-xl border-2 bg-white text-center font-mono text-2xl font-bold transition-all outline-none select-none',
                // Text color
                'text-neutral-dark',
                // Border & Shadow states
                hasError
                  ? 'border-red-400 bg-red-50/20 text-red-700 focus:border-red-500 focus:ring-4 focus:ring-red-100'
                  : isFocused
                    ? 'border-primary bg-white shadow-sm ring-4 ring-primary/15'
                    : isFilled
                      ? 'border-neutral-dark/40 bg-neutral-light/20 shadow-xs'
                      : 'border-neutral-300 bg-white hover:border-neutral-400 shadow-xs',
                disabled && 'cursor-not-allowed opacity-50 bg-neutral-light',
              )}
            />
            {/* Subtle active empty cursor highlight */}
            {isFocused && !digit && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="h-6 w-0.5 animate-pulse bg-primary rounded-full" />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
