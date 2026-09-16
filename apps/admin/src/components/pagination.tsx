'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  pageSizeOptions?: number[];
  basePath: string;
  queryParams: Record<string, string | undefined>;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  pageSizeOptions = [10, 25, 50, 100],
  basePath,
  queryParams,
}: PaginationProps) {
  const router = useRouter();

  const buildUrl = (targetPage: number, targetLimit?: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(queryParams)) {
      if (v !== undefined && v !== '' && k !== 'page' && k !== 'limit') {
        sp.set(k, v);
      }
    }
    sp.set('page', String(targetPage));
    sp.set('limit', String(targetLimit ?? pageSize));
    return `${basePath}?${sp.toString()}`;
  };

  const handlePageSizeChange = (newSize: number) => {
    // Resetting to page 1 is mandatory when page size changes
    const url = buildUrl(1, newSize);
    router.push(url);
  };

  const from = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers with smart ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) {
        pages.push('...');
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }
      pages.push(totalPages);
    }
    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-1">
      {/* Range summary & page size selector */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-mid">
        <span>
          Showing <strong className="text-neutral-dark font-semibold">{from}</strong> to{' '}
          <strong className="text-neutral-dark font-semibold">{to}</strong> of{' '}
          <strong className="text-neutral-dark font-semibold">{totalItems}</strong> items
        </span>

        <div className="flex items-center gap-1.5 border-l border-neutral-200 pl-3">
          <span>Per page:</span>
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="h-8 rounded-lg border border-neutral-300 bg-white px-2 py-0 text-xs font-semibold text-neutral-dark outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 shadow-xs transition"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Page navigation buttons */}
      {totalPages > 1 && (
        <nav aria-label="Pagination Navigation" className="flex items-center gap-1">
          {/* Previous Page */}
          <Link
            href={currentPage > 1 ? buildUrl(currentPage - 1) : '#'}
            aria-disabled={currentPage <= 1}
            tabIndex={currentPage <= 1 ? -1 : undefined}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 text-xs font-semibold transition shadow-xs ${
              currentPage <= 1
                ? 'opacity-30 pointer-events-none bg-neutral-100 text-neutral-400'
                : 'bg-white text-neutral-dark hover:border-primary hover:text-primary hover:bg-primary-light/10'
            }`}
          >
            <ChevronLeft size={16} />
            <span className="sr-only">Previous Page</span>
          </Link>

          {/* Page numbers */}
          {pages.map((p, idx) => {
            if (p === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="inline-flex h-9 w-7 items-center justify-center text-xs text-neutral-mid"
                >
                  ...
                </span>
              );
            }

            const pageNum = Number(p);
            const isActive = pageNum === currentPage;

            return (
              <Link
                key={pageNum}
                href={buildUrl(pageNum)}
                aria-current={isActive ? 'page' : undefined}
                className={`inline-flex h-9 min-w-[36px] px-2 items-center justify-center rounded-xl border text-xs font-semibold transition shadow-xs ${
                  isActive
                    ? 'border-primary bg-primary text-white pointer-events-none'
                    : 'border-neutral-200 bg-white text-neutral-dark hover:border-primary hover:text-primary hover:bg-primary-light/10'
                }`}
              >
                {pageNum}
              </Link>
            );
          })}

          {/* Next Page */}
          <Link
            href={currentPage < totalPages ? buildUrl(currentPage + 1) : '#'}
            aria-disabled={currentPage >= totalPages}
            tabIndex={currentPage >= totalPages ? -1 : undefined}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 text-xs font-semibold transition shadow-xs ${
              currentPage >= totalPages
                ? 'opacity-30 pointer-events-none bg-neutral-100 text-neutral-400'
                : 'bg-white text-neutral-dark hover:border-primary hover:text-primary hover:bg-primary-light/10'
            }`}
          >
            <ChevronRight size={16} />
            <span className="sr-only">Next Page</span>
          </Link>
        </nav>
      )}
    </div>
  );
}
