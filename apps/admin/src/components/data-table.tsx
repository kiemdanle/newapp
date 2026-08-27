import type { ReactNode } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Inbox } from 'lucide-react';

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  empty?: string;
}

/**
 * Server-rendered table wrapped in a modern card container.
 */
export function DataTable<T>({ data, columns, empty = 'No results found.' }: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center shadow-card">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-light/70 text-neutral-mid/80">
          <Inbox size={24} />
        </div>
        <p className="text-sm font-medium text-neutral-dark">{empty}</p>
        <p className="mt-1 text-xs text-neutral-mid">No records match your active criteria.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c, i) => (
              <TableHead key={i} className={c.className}>
                {c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, ri) => (
            <TableRow key={ri}>
              {columns.map((c, ci) => (
                <TableCell key={ci} className={c.className}>
                  {c.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
