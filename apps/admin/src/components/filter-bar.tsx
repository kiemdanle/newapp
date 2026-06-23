'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';

export function FilterBar({ action, children }: { action: string; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);

  function activeCount(): number {
    if (typeof window === 'undefined') return 0;
    const form = document.querySelector(`form[action="${action}"]`);
    if (!form) return 0;
    const inputs = form.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      'input:not([type="submit"]):not([type="hidden"]), select',
    );
    let count = 0;
    inputs.forEach((el) => {
      if (el.value && el.value !== '') count++;
    });
    return count;
  }

  // Try reading active count from DOM on initial render
  const count = typeof window !== 'undefined' ? activeCount() : 0;
  const label = count > 0 ? `Filters (${count})` : 'Filters';

  return (
    <form method="get" action={action}>
      {/* Mobile toggle */}
      <div className="lg:hidden mb-2">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-mid hover:text-neutral-dark"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {label}
        </button>
      </div>

      {/* Filter controls — hidden on mobile when collapsed */}
      <div className={`flex flex-wrap items-end gap-3 ${!expanded ? 'hidden' : 'flex'} lg:flex`}>
        {children}
        <Button type="submit" variant="outline" size="sm">
          Apply
        </Button>
      </div>
    </form>
  );
}

export function SelectFilter({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value?: string | undefined;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-neutral-mid font-body">
      {label}
      <select
        name={name}
        defaultValue={value ?? ''}
        className="h-9 rounded-md border bg-background px-3 text-sm text-neutral-dark"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TextFilter({
  name,
  label,
  value,
  placeholder,
}: {
  name: string;
  label: string;
  value?: string | undefined;
  placeholder?: string | undefined;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-neutral-mid font-body">
      {label}
      <input
        type="text"
        name={name}
        defaultValue={value ?? ''}
        placeholder={placeholder}
        className="h-9 rounded-md border bg-background px-3 text-sm text-neutral-dark placeholder:text-neutral-mid/60"
      />
    </label>
  );
}
