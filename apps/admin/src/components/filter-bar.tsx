'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Filter, Search } from 'lucide-react';

export function FilterBar({ action, children }: { action: string; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);

  function activeCount(): number {
    if (typeof window === 'undefined') return 0;
    const url = new URL(window.location.href);
    let count = 0;
    for (const [k, v] of url.searchParams) {
      if (k !== 'cursor' && v) count++;
    }
    return count;
  }

  const count = typeof window !== 'undefined' ? activeCount() : 0;
  const label = count > 0 ? `Filters (${count})` : 'Filters';

  return (
    <form
      method="get"
      action={action}
      className="rounded-2xl border border-border bg-card p-4 shadow-card"
    >
      {/* Mobile toggle */}
      <div className="lg:hidden mb-2">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-dark hover:text-primary transition-colors"
        >
          <Filter size={16} className="text-primary" />
          <span>{label}</span>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Filter controls — hidden on mobile when collapsed */}
      <div
        className={`flex flex-wrap items-end gap-3.5 ${
          !expanded ? 'hidden' : 'flex'
        } lg:flex`}
      >
        {children}
        <Button
          type="submit"
          variant="default"
          size="sm"
          className="h-10 px-4 rounded-xl gap-1.5"
        >
          <Search size={14} />
          <span>Apply</span>
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
    <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-mid font-body">
      <span>{label}</span>
      <select
        name={name}
        defaultValue={value ?? ''}
        className="h-10 rounded-xl border border-neutral-300 bg-white px-3 text-sm font-normal text-neutral-dark outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/15 shadow-xs"
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
    <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-mid font-body">
      <span>{label}</span>
      <input
        type="text"
        name={name}
        defaultValue={value ?? ''}
        placeholder={placeholder}
        className="h-10 rounded-xl border border-neutral-300 bg-white px-3.5 text-sm font-normal text-neutral-dark placeholder:text-neutral-mid/50 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/15 shadow-xs"
      />
    </label>
  );
}
