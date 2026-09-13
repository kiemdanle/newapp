'use client';

import * as React from 'react';
import type { BarcodeApiCallLogRow, BarcodeApiStatus, BarcodeApiCallerContext } from '@expyrico/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Clock,
  ExternalLink,
  Filter,
  Layers,
  Search,
  Tag,
  Zap,
} from 'lucide-react';

interface RequestLogTableProps {
  initialItems: BarcodeApiCallLogRow[];
  initialNextCursor: string | null;
  onInspect: (logId: string) => void;
}

export function RequestLogTable({
  initialItems,
  initialNextCursor,
  onInspect,
}: RequestLogTableProps) {
  const [items] = React.useState<BarcodeApiCallLogRow[]>(initialItems);
  const [searchBarcode, setSearchBarcode] = React.useState('');
  const [selectedProvider, setSelectedProvider] = React.useState<string>('all');
  const [selectedStatus, setSelectedStatus] = React.useState<string>('all');
  const [selectedContext, setSelectedContext] = React.useState<string>('all');

  const filteredItems = items.filter((row) => {
    if (searchBarcode.trim() && !row.barcode.includes(searchBarcode.trim())) {
      return false;
    }
    if (selectedProvider !== 'all' && row.provider !== selectedProvider) {
      return false;
    }
    if (selectedStatus !== 'all' && row.status !== selectedStatus) {
      return false;
    }
    if (selectedContext !== 'all' && row.callerContext !== selectedContext) {
      return false;
    }
    return true;
  });

  const getStatusPill = (status: BarcodeApiStatus) => {
    switch (status) {
      case 'hit':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#D6F0E6] text-[#3A8F6F] border border-[#4BAE8A]/30 font-mono">
            hit
          </span>
        );
      case 'miss':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#F0F0ED] text-[#8C8C85] border border-border font-mono">
            miss
          </span>
        );
      case 'rate_limited':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#FEEFC3] text-[#F5A623] border border-[#F5A623]/40 font-mono">
            429 limited
          </span>
        );
      case 'cooldown_skipped':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#FEEFC3] text-[#F5A623] border border-[#F5A623]/40 font-mono">
            cooldown skip
          </span>
        );
      case 'timeout':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-50 text-[#E0442A] border border-[#E0442A]/30 font-mono">
            timeout
          </span>
        );
      case 'error':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-50 text-[#E0442A] border border-[#E0442A]/30 font-mono">
            error
          </span>
        );
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  return (
    <div className="rounded-2xl border border-border bg-[#FAFAF8] p-5 shadow-xs">
      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-border/70">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8C8C85]" />
          <Input
            type="text"
            placeholder="Search by barcode..."
            value={searchBarcode}
            onChange={(e) => setSearchBarcode(e.target.value)}
            className="pl-9 h-10 min-h-[44px] text-xs bg-white rounded-xl border-border"
          />
        </div>

        {/* Filter dropdowns & chips */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Provider */}
          <select
            aria-label="Filter by provider"
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            className="h-10 min-h-[44px] px-3 rounded-xl border border-border bg-white text-xs text-[#2C2C28] font-medium outline-none focus:ring-2 focus:ring-[#4BAE8A]/20"
          >
            <option value="all">All Providers</option>
            <option value="off">OpenFoodFacts</option>
            <option value="upcitemdb">UPCitemdb</option>
          </select>

          {/* Status */}
          <select
            aria-label="Filter by status"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-10 min-h-[44px] px-3 rounded-xl border border-border bg-white text-xs text-[#2C2C28] font-medium outline-none focus:ring-2 focus:ring-[#4BAE8A]/20"
          >
            <option value="all">All Outcomes</option>
            <option value="hit">Hits</option>
            <option value="miss">Misses</option>
            <option value="rate_limited">Rate Limited</option>
            <option value="cooldown_skipped">Cooldown Skips</option>
            <option value="timeout">Timeouts</option>
            <option value="error">Errors</option>
          </select>

          {/* Caller Context */}
          <select
            aria-label="Filter by caller context"
            value={selectedContext}
            onChange={(e) => setSelectedContext(e.target.value)}
            className="h-10 min-h-[44px] px-3 rounded-xl border border-border bg-white text-xs text-[#2C2C28] font-medium outline-none focus:ring-2 focus:ring-[#4BAE8A]/20"
          >
            <option value="all">All Contexts</option>
            <option value="sync_lookup">App User Scan</option>
            <option value="backfill_worker">Backfill Worker</option>
            <option value="admin_probe">Admin Diagnostic Probe</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border/70 text-[#8C8C85] font-semibold tracking-wider uppercase text-[10px]">
              <th className="py-2.5 px-3">Time</th>
              <th className="py-2.5 px-3">Provider</th>
              <th className="py-2.5 px-3">Context</th>
              <th className="py-2.5 px-3">Barcode</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">HTTP</th>
              <th className="py-2.5 px-3">Latency</th>
              <th className="py-2.5 px-3 text-right">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[#8C8C85]">
                  No request log entries match the selected filters.
                </td>
              </tr>
            ) : (
              filteredItems.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-white transition-colors duration-150 group"
                >
                  <td className="py-3 px-3 font-mono text-xs text-[#8C8C85]">
                    {formatTime(row.createdAt)}
                  </td>
                  <td className="py-3 px-3 font-semibold text-[#2C2C28]">
                    {row.provider === 'off'
                      ? 'OpenFoodFacts'
                      : row.provider === 'upcitemdb'
                        ? 'UPCitemdb'
                        : row.provider}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-md ${
                        row.callerContext === 'admin_probe'
                          ? 'bg-[#D6F0E6] text-[#3A8F6F]'
                          : row.callerContext === 'backfill_worker'
                            ? 'bg-[#F0F0ED] text-[#8C8C85]'
                            : 'bg-white text-[#2C2C28] border border-border/60'
                      }`}
                    >
                      {row.callerContext === 'admin_probe'
                        ? 'probe'
                        : row.callerContext === 'backfill_worker'
                          ? 'backfill'
                          : 'user'}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono font-semibold text-[#2C2C28]">
                    {row.barcode}
                  </td>
                  <td className="py-3 px-3">{getStatusPill(row.status)}</td>
                  <td className="py-3 px-3 font-mono font-medium text-[#8C8C85]">
                    {row.httpStatus ? (
                      <span
                        className={
                          row.httpStatus >= 400
                            ? row.httpStatus === 429
                              ? 'text-[#F5A623] font-bold'
                              : 'text-[#E0442A] font-bold'
                            : 'text-[#3A8F6F]'
                        }
                      >
                        {row.httpStatus}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-3 px-3 font-mono text-[#2C2C28]">
                    <span className={row.durationMs > 1500 ? 'text-[#F5A623] font-bold' : ''}>
                      {row.durationMs}ms
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onInspect(row.id)}
                      className="h-8 min-h-[44px] min-w-[44px] px-2.5 text-xs text-[#3A8F6F] hover:bg-[#D6F0E6]/50"
                    >
                      <ExternalLink size={13} className="mr-1" />
                      Details
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer / Count summary */}
      <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/60 text-xs text-[#8C8C85]">
        <span>
          Showing <strong>{filteredItems.length}</strong> of <strong>{items.length}</strong> loaded calls
        </span>
        {initialNextCursor && (
          <span className="text-[11px] italic">
            More historical logs available via time-range selection
          </span>
        )}
      </div>
    </div>
  );
}
