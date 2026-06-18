import type { ReactNode } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
 * Server-rendered table. Reads come from Server Components, so this is a plain
 * presentational table (no client-side fetching). Pagination is handled by the
 * `<LoadMore>` link which advances the `cursor` query param.
 */
export function DataTable<T>({ data, columns, empty = 'No results.' }: DataTableProps<T>) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">{empty}</p>;
  }
  return (
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
  );
}
