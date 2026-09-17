'use client';

import React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { GoogleMapsLogItem } from '@expyrico/shared';
import {
  MapPin,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  Zap,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';

export function RequestLogTable({
  logs,
  totalLogs,
  page,
  totalPages,
  status,
}: {
  logs: GoogleMapsLogItem[];
  totalLogs: number;
  page: number;
  totalPages: number;
  status: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParam = (key: string, val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (val === 'all' || !val) {
      params.delete(key);
    } else {
      params.set(key, val);
    }
    if (key !== 'page') params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  };

  const renderStatusBadge = (logStatus: string, httpStatus: number | null) => {
    if (logStatus === 'cached') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
          <Zap size={10} />
          Cached
        </span>
      );
    }
    if (logStatus === 'success') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
          <CheckCircle2 size={10} />
          200 OK
        </span>
      );
    }
    if (logStatus === 'rate_limited') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
          <AlertCircle size={10} />
          429 Limit
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
        <AlertCircle size={10} />
        {httpStatus || 500} Error
      </span>
    );
  };

  return (
    <div className="bg-white border border-neutral-light rounded-2xl shadow-sm overflow-hidden">
      {/* Table Header Controls */}
      <div className="px-6 py-4 border-b border-neutral-light flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-neutral-dark">Request Audit Logs</h3>
          <p className="text-xs text-neutral-mid mt-0.5">
            Showing {logs.length} of {totalLogs} reverse-geocode invocations
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-neutral-light/50 p-1 rounded-xl border border-neutral-light text-xs font-semibold">
          {['all', 'success', 'cached', 'error'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => updateParam('status', s)}
              className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
                status === s
                  ? 'bg-white text-neutral-dark shadow-sm'
                  : 'text-neutral-mid hover:text-neutral-dark'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-neutral-light/30 border-b border-neutral-light text-neutral-mid font-semibold uppercase tracking-wider">
            <tr>
              <th className="py-3 px-6">Timestamp</th>
              <th className="py-3 px-4">Member</th>
              <th className="py-3 px-4">Coordinates</th>
              <th className="py-3 px-4">Resolved Neighbourhood</th>
              <th className="py-3 px-4">Country</th>
              <th className="py-3 px-4">Latency</th>
              <th className="py-3 px-6 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-light/60">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-neutral-mid">
                  No geocoding requests recorded for this period.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-neutral-light/20 transition">
                  <td className="py-3 px-6 whitespace-nowrap text-neutral-dark font-mono">
                    {new Date(log.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}{' '}
                    <span className="text-[10px] text-neutral-mid">
                      {new Date(log.createdAt).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {log.userEmail ? (
                      <span className="text-neutral-dark font-medium">{log.userEmail}</span>
                    ) : (
                      <span className="text-neutral-mid italic">System/Guest</span>
                    )}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap font-mono text-neutral-mid">
                    {log.latitude.toFixed(4)}, {log.longitude.toFixed(4)}
                  </td>
                  <td className="py-3 px-4 max-w-xs truncate text-neutral-dark font-medium" title={log.formattedAddress || ''}>
                    {log.formattedAddress ? (
                      <span className="flex items-center gap-1">
                        <MapPin size={12} className="text-primary shrink-0" />
                        <span className="truncate">{log.formattedAddress}</span>
                      </span>
                    ) : (
                      <span className="text-neutral-mid italic">{log.errorMessage || 'No address'}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap font-mono font-semibold text-neutral-dark">
                    {log.countryCode || '—'}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap font-mono text-neutral-mid">
                    {log.durationMs} ms
                  </td>
                  <td className="py-3 px-6 whitespace-nowrap text-right">
                    {renderStatusBadge(log.status, log.httpStatus)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Table Pagination Footer */}
      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-neutral-light flex items-center justify-between text-xs text-neutral-mid">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => updateParam('page', String(page - 1))}
              disabled={page <= 1}
              className="p-1 rounded-lg border border-neutral-light hover:bg-neutral-light disabled:opacity-40 disabled:pointer-events-none transition"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => updateParam('page', String(page + 1))}
              disabled={page >= totalPages}
              className="p-1 rounded-lg border border-neutral-light hover:bg-neutral-light disabled:opacity-40 disabled:pointer-events-none transition"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
