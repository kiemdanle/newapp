'use client';

import * as React from 'react';
import type { TopBarcode, TopMiss } from '@expyrico/shared';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowUpRight, Barcode, Flame } from 'lucide-react';

interface TopBarcodesCardProps {
  topBarcodes: TopBarcode[];
  topMisses: TopMiss[];
  onProbeBarcode: (barcode: string) => void;
}

export function TopBarcodesCard({
  topBarcodes,
  topMisses,
  onProbeBarcode,
}: TopBarcodesCardProps) {
  const [activeTab, setActiveTab] = React.useState<'top' | 'misses'>('top');

  return (
    <div className="rounded-2xl border border-border bg-[#FAFAF8] p-5 shadow-xs">
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-border/70">
        <div className="flex items-center gap-2">
          <Barcode size={16} className="text-[#3A8F6F]" />
          <h3 className="text-sm font-bold text-[#2C2C28] font-display">
            Barcode Traffic Intelligence
          </h3>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 p-1 bg-white border border-border rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('top')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all min-h-[36px] ${
              activeTab === 'top'
                ? 'bg-[#4BAE8A] text-white shadow-xs'
                : 'text-[#8C8C85] hover:text-[#2C2C28]'
            }`}
          >
            Top Lookups ({topBarcodes.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('misses')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all min-h-[36px] ${
              activeTab === 'misses'
                ? 'bg-[#4BAE8A] text-white shadow-xs'
                : 'text-[#8C8C85] hover:text-[#2C2C28]'
            }`}
          >
            Frequent Misses ({topMisses.length})
          </button>
        </div>
      </div>

      {activeTab === 'top' ? (
        topBarcodes.length === 0 ? (
          <p className="py-8 text-center text-xs text-[#8C8C85]">
            No barcode lookups recorded for this time range.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/70 text-[#8C8C85] font-semibold uppercase text-[10px]">
                  <th className="py-2 px-2.5">Barcode</th>
                  <th className="py-2 px-2.5">Total Calls</th>
                  <th className="py-2 px-2.5">Hits</th>
                  <th className="py-2 px-2.5">Misses</th>
                  <th className="py-2 px-2.5 text-right">Test</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {topBarcodes.map((item) => (
                  <tr key={item.barcode} className="hover:bg-white transition-colors">
                    <td className="py-2.5 px-2.5 font-mono font-semibold text-[#2C2C28]">
                      {item.barcode}
                    </td>
                    <td className="py-2.5 px-2.5 font-mono font-bold text-[#2C2C28]">
                      {item.totalCalls}
                    </td>
                    <td className="py-2.5 px-2.5 font-mono text-[#3A8F6F]">
                      {item.hitCount}
                    </td>
                    <td className="py-2.5 px-2.5 font-mono text-[#8C8C85]">
                      {item.missCount}
                    </td>
                    <td className="py-2.5 px-2.5 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onProbeBarcode(item.barcode)}
                        className="h-8 min-h-[44px] min-w-[44px] px-2 text-xs text-[#3A8F6F] hover:bg-[#D6F0E6]/50"
                      >
                        <ArrowUpRight size={13} className="mr-0.5" />
                        Probe
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : topMisses.length === 0 ? (
        <p className="py-8 text-center text-xs text-[#8C8C85]">
          No frequent misses found in this range.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/70 text-[#8C8C85] font-semibold uppercase text-[10px]">
                <th className="py-2 px-2.5">Unresolved Barcode</th>
                <th className="py-2 px-2.5">Miss Count</th>
                <th className="py-2 px-2.5">Last Attempted</th>
                <th className="py-2 px-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {topMisses.map((item) => (
                <tr key={item.barcode} className="hover:bg-white transition-colors">
                  <td className="py-2.5 px-2.5 font-mono font-semibold text-[#2C2C28]">
                    {item.barcode}
                  </td>
                  <td className="py-2.5 px-2.5 font-mono font-bold text-[#F5A623]">
                    {item.missCount}
                  </td>
                  <td className="py-2.5 px-2.5 font-mono text-[11px] text-[#8C8C85]">
                    {new Date(item.lastQueriedAt).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-2.5 px-2.5 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onProbeBarcode(item.barcode)}
                      className="h-8 min-h-[44px] min-w-[44px] px-2 text-xs text-[#3A8F6F] hover:bg-[#D6F0E6]/50"
                    >
                      <ArrowUpRight size={13} className="mr-0.5" />
                      Probe
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
