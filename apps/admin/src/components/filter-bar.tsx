import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Plain server-rendered GET form. Filter controls submit via the URL query
 * string, which drives the Server Component's data fetch. No client JS.
 */
export function FilterBar({ action, children }: { action: string; children: ReactNode }) {
  return (
    <form method="get" action={action} className="flex flex-wrap items-end gap-3">
      {children}
      <Button type="submit" variant="outline" size="sm">
        Apply
      </Button>
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
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <select
        name={name}
        defaultValue={value ?? ''}
        className="h-9 rounded-md border bg-background px-2 text-sm text-foreground"
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
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <input
        type="text"
        name={name}
        defaultValue={value ?? ''}
        placeholder={placeholder}
        className="h-9 rounded-md border bg-background px-2 text-sm text-foreground"
      />
    </label>
  );
}
