'use client';

import * as React from 'react';
import type { BarcodeApiCallLogDetail } from '@expyrico/shared';
import { fetchBarcodeApiRequestDetailAction } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import {
  Check,
  Clock,
  Copy,
  FileCode,
  Globe,
  Loader2,
  Server,
  User,
  X,
  Zap,
} from 'lucide-react';

interface RequestDetailModalProps {
  logId: string | null;
  onClose: () => void;
}

export function RequestDetailModal({ logId, onClose }: RequestDetailModalProps) {
  const [detail, setDetail] = React.useState<BarcodeApiCallLogDetail | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!logId) {
      setDetail(null);
      return;
    }

    let active = true;
    setLoading(true);

    fetchBarcodeApiRequestDetailAction(logId)
      .then((res) => {
        if (active && res.ok && res.data) {
          setDetail(res.data);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [logId]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (!logId) return null;

  const handleCopyPreview = () => {
    if (!detail?.rawResponsePreview) return;
    navigator.clipboard.writeText(detail.rawResponsePreview);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-border bg-white shadow-dropdown overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-[#FAFAF8]">
          <div className="flex items-center gap-2">
            <FileCode className="h-5 w-5 text-[#3A8F6F]" />
            <h2 id="modal-title" className="text-base font-bold text-[#2C2C28] font-display">
              Barcode API Call Diagnostics
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="flex items-center justify-center h-11 w-11 rounded-xl text-[#8C8C85] hover:text-[#2C2C28] hover:bg-[#F0F0ED] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-[#8C8C85] gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-[#4BAE8A]" />
              <p className="text-sm">Loading full call telemetry...</p>
            </div>
          ) : !detail ? (
            <div className="py-12 text-center text-sm text-[#8C8C85]">
              Request details could not be loaded or the record has been pruned.
            </div>
          ) : (
            <>
              {/* Summary Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-[#FAFAF8] border border-border/70">
                  <span className="text-[11px] font-semibold text-[#8C8C85] uppercase tracking-wider block">
                    Provider
                  </span>
                  <span className="text-sm font-bold text-[#2C2C28] font-display mt-0.5 block">
                    {detail.provider === 'off'
                      ? 'OpenFoodFacts'
                      : detail.provider === 'upcitemdb'
                        ? 'UPCitemdb'
                        : detail.provider}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#FAFAF8] border border-border/70">
                  <span className="text-[11px] font-semibold text-[#8C8C85] uppercase tracking-wider block">
                    Barcode
                  </span>
                  <span className="text-sm font-bold text-[#2C2C28] font-mono mt-0.5 block">
                    {detail.barcode}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#FAFAF8] border border-border/70">
                  <span className="text-[11px] font-semibold text-[#8C8C85] uppercase tracking-wider block">
                    Status / HTTP Code
                  </span>
                  <span className="text-sm font-bold font-mono mt-0.5 block">
                    <span
                      className={`inline-block mr-1.5 ${
                        detail.status === 'hit'
                          ? 'text-[#3A8F6F]'
                          : detail.status === 'rate_limited'
                            ? 'text-[#F5A623]'
                            : detail.status === 'miss'
                              ? 'text-[#8C8C85]'
                              : 'text-[#E0442A]'
                      }`}
                    >
                      {detail.status}
                    </span>
                    <span className="text-[#8C8C85]">({detail.httpStatus ?? 'ERR'})</span>
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#FAFAF8] border border-border/70">
                  <span className="text-[11px] font-semibold text-[#8C8C85] uppercase tracking-wider block flex items-center gap-1">
                    <Clock size={12} /> Latency
                  </span>
                  <span className="text-sm font-bold text-[#2C2C28] font-mono mt-0.5 block">
                    {detail.durationMs}ms
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#FAFAF8] border border-border/70">
                  <span className="text-[11px] font-semibold text-[#8C8C85] uppercase tracking-wider block">
                    Caller Context
                  </span>
                  <span className="text-sm font-semibold text-[#3A8F6F] mt-0.5 block">
                    {detail.callerContext}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#FAFAF8] border border-border/70">
                  <span className="text-[11px] font-semibold text-[#8C8C85] uppercase tracking-wider block">
                    Payload Size
                  </span>
                  <span className="text-sm font-bold text-[#2C2C28] font-mono mt-0.5 block">
                    {detail.responseSizeBytes ? `${detail.responseSizeBytes} B` : '—'}
                  </span>
                </div>
              </div>

              {/* Endpoint */}
              <div className="p-3 rounded-xl bg-[#FAFAF8] border border-border/70 text-xs">
                <span className="text-[11px] font-semibold text-[#8C8C85] uppercase tracking-wider block mb-1">
                  Dispatched Endpoint ({detail.httpMethod})
                </span>
                <span className="font-mono text-[#2C2C28] break-all select-all">
                  {detail.endpoint}
                </span>
              </div>

              {/* Error message banner if any */}
              {detail.errorMessage && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-[#E0442A]">
                  <strong className="font-semibold block mb-0.5">Error Message:</strong>
                  <span>{detail.errorMessage}</span>
                </div>
              )}

              {/* Response Headers */}
              <div>
                <h4 className="text-xs font-bold text-[#2C2C28] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Server size={14} className="text-[#3A8F6F]" />
                  Response Headers
                </h4>
                {detail.responseHeaders && Object.keys(detail.responseHeaders).length > 0 ? (
                  <div className="rounded-xl border border-border bg-[#FAFAF8] p-3 text-xs font-mono max-h-40 overflow-y-auto select-all">
                    {Object.entries(detail.responseHeaders).map(([k, v]) => (
                      <div key={k} className="py-0.5 flex gap-2">
                        <span className="text-[#8C8C85] font-semibold">{k}:</span>
                        <span className="text-[#2C2C28]">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#8C8C85] italic">No response headers captured.</p>
                )}
              </div>

              {/* Raw Response Preview */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-[#2C2C28] uppercase tracking-wider flex items-center gap-1.5">
                    <Globe size={14} className="text-[#3A8F6F]" />
                    Raw Response Preview (Bounded 4KB)
                  </h4>
                  {detail.rawResponsePreview && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCopyPreview}
                      className="h-7 text-[11px] px-2"
                    >
                      {copied ? (
                        <>
                          <Check size={12} className="mr-1 text-[#3A8F6F]" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy size={12} className="mr-1" />
                          Copy JSON
                        </>
                      )}
                    </Button>
                  )}
                </div>
                {detail.rawResponsePreview ? (
                  <pre className="rounded-xl border border-border bg-[#2C2C28] text-white p-3.5 text-xs font-mono max-h-60 overflow-y-auto whitespace-pre-wrap break-all select-all">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(detail.rawResponsePreview), null, 2);
                      } catch {
                        return detail.rawResponsePreview;
                      }
                    })()}
                  </pre>
                ) : (
                  <p className="text-xs text-[#8C8C85] italic">No response payload recorded.</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-border bg-[#FAFAF8]">
          <Button
            variant="outline"
            onClick={onClose}
            className="h-10 min-h-[44px] min-w-[44px] px-5 text-xs font-semibold"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
