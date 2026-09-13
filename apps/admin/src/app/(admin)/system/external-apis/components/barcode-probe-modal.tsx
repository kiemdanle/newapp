'use client';

import * as React from 'react';
import type { BarcodeApiProbeResponse } from '@expyrico/shared';
import { probeBarcodeApiAction } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertTriangle,
  Barcode,
  CheckCircle2,
  Clock,
  Copy,
  Info,
  Loader2,
  Package,
  Play,
  Server,
  X,
  Zap,
} from 'lucide-react';

interface BarcodeProbeModalProps {
  isOpen: boolean;
  initialProvider?: string;
  onClose: () => void;
}

const PRESET_BARCODES = [
  { label: 'Coca-Cola 330ml (OFF hit)', code: '5449000000996', provider: 'off' },
  { label: 'Nutella 400g (OFF hit)', code: '3017620422003', provider: 'off' },
  { label: 'Standard UPC (UPCitemdb test)', code: '012345678905', provider: 'upcitemdb' },
  { label: 'Non-existent item (conclusive miss)', code: '9999999999999', provider: 'off' },
];

export function BarcodeProbeModal({
  isOpen,
  initialProvider = 'off',
  onClose,
}: BarcodeProbeModalProps) {
  const [barcode, setBarcode] = React.useState('5449000000996');
  const [provider, setProvider] = React.useState(initialProvider);
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<BarcodeApiProbeResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setProvider(initialProvider);
  }, [initialProvider]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', onKeyDown);
    }
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleRunProbe = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!barcode.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await probeBarcodeApiAction({
        barcode: barcode.trim(),
        provider,
      });
      if (res.ok) {
        setResult(res.data);
      } else {
        setError(res.detail || res.code || 'Diagnostic probe request failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApplyPreset = (code: string, prov: string) => {
    setBarcode(code);
    setProvider(prov);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl border border-border bg-white shadow-dropdown overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="probe-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-[#FAFAF8]">
          <div className="flex items-center gap-2">
            <Barcode className="h-5 w-5 text-[#3A8F6F]" />
            <div>
              <h2 id="probe-modal-title" className="text-base font-bold text-[#2C2C28] font-display">
                Live Barcode Diagnostic Probe
              </h2>
              <p className="text-xs text-[#8C8C85]">
                Direct live upstream lookup with real latency & payload inspection
              </p>
            </div>
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
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Isolation banner */}
          <div className="p-3 rounded-xl bg-[#D6F0E6]/50 border border-[#4BAE8A]/30 flex items-start gap-2 text-xs text-[#3A8F6F]">
            <Info size={16} className="text-[#3A8F6F] shrink-0 mt-0.5" />
            <span>
              Diagnostic probes are logged as <strong>admin_probe</strong>. They bypass breaker trips and are automatically filtered out from organic user scan analytics.
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleRunProbe} className="space-y-4">
            <div>
              <label htmlFor="probe-provider" className="block text-xs font-semibold text-[#2C2C28] mb-1.5">
                Target Registry Provider
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setProvider('off')}
                  className={`flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all min-h-[44px] ${
                    provider === 'off'
                      ? 'border-[#4BAE8A] bg-[#D6F0E6]/30 text-[#3A8F6F] shadow-xs'
                      : 'border-border bg-white text-[#2C2C28] hover:bg-[#FAFAF8]'
                  }`}
                >
                  <span>OpenFoodFacts</span>
                  <span className="text-[10px] font-mono text-[#8C8C85]">off</span>
                </button>

                <button
                  type="button"
                  onClick={() => setProvider('upcitemdb')}
                  className={`flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all min-h-[44px] ${
                    provider === 'upcitemdb'
                      ? 'border-[#4BAE8A] bg-[#D6F0E6]/30 text-[#3A8F6F] shadow-xs'
                      : 'border-border bg-white text-[#2C2C28] hover:bg-[#FAFAF8]'
                  }`}
                >
                  <span>UPCitemdb</span>
                  <span className="text-[10px] font-mono text-[#8C8C85]">upcitemdb</span>
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="probe-barcode" className="block text-xs font-semibold text-[#2C2C28] mb-1.5">
                Product Barcode (UPC / EAN / GTIN)
              </label>
              <div className="flex gap-2">
                <Input
                  id="probe-barcode"
                  type="text"
                  placeholder="e.g. 5449000000996"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="h-11 font-mono text-sm bg-white rounded-xl border-border flex-1"
                />
                <Button
                  type="submit"
                  disabled={loading || !barcode.trim()}
                  className="h-11 min-w-[120px] bg-[#4BAE8A] hover:bg-[#3A8F6F] text-white font-semibold text-xs rounded-xl shadow-xs"
                >
                  {loading ? (
                    <>
                      <Loader2 size={15} className="mr-1.5 animate-spin" />
                      Probing...
                    </>
                  ) : (
                    <>
                      <Play size={14} className="mr-1.5" />
                      Send Probe
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Presets */}
            <div>
              <span className="text-[11px] font-medium text-[#8C8C85] block mb-1.5">
                1-Click Diagnostic Presets:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_BARCODES.map((preset) => (
                  <button
                    key={preset.code}
                    type="button"
                    onClick={() => handleApplyPreset(preset.code, preset.provider)}
                    className="px-2.5 py-1 text-[11px] rounded-lg bg-[#F0F0ED] hover:bg-[#FEEFC3] text-[#2C2C28] border border-border/70 transition-colors font-medium min-h-[36px]"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </form>

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-[#E0442A] flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Live Result Output */}
          {result && (
            <div className="rounded-xl border border-border bg-[#FAFAF8] p-4 space-y-3.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-2.5 border-b border-border/70">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      result.status === 'hit'
                        ? 'bg-[#D6F0E6] text-[#3A8F6F] border border-[#4BAE8A]/30'
                        : result.status === 'rate_limited'
                          ? 'bg-[#FEEFC3] text-[#F5A623] border border-[#F5A623]/30'
                          : result.status === 'miss'
                            ? 'bg-[#F0F0ED] text-[#8C8C85] border border-border'
                            : 'bg-red-50 text-[#E0442A] border border-[#E0442A]/30'
                    }`}
                  >
                    {result.status === 'hit' && <CheckCircle2 size={12} />}
                    {result.status.toUpperCase()}
                  </span>
                  <span className="text-xs font-mono text-[#8C8C85]">
                    HTTP {result.httpStatus ?? 'ERR'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs font-mono font-semibold text-[#2C2C28]">
                  <Clock size={13} className="text-[#3A8F6F]" />
                  <span>{result.durationMs}ms</span>
                </div>
              </div>

              {/* Parsed product */}
              {result.parsedProduct?.found ? (
                <div className="p-3 rounded-xl bg-white border border-border/80 shadow-2xs">
                  <div className="flex items-start gap-2.5">
                    <Package size={18} className="text-[#3A8F6F] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-[#2C2C28] font-display">
                        {result.parsedProduct.name || 'Unnamed Product'}
                      </h4>
                      <p className="text-xs text-[#8C8C85] mt-0.5">
                        Brand: {result.parsedProduct.brand || '—'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-white border border-border/70 text-xs text-[#8C8C85]">
                  No product was extracted from this response.
                </div>
              )}

              {/* Raw JSON Preview */}
              {result.rawResponsePreview && (
                <div>
                  <span className="text-[11px] font-semibold text-[#8C8C85] uppercase tracking-wider block mb-1">
                    Raw Upstream Response
                  </span>
                  <pre className="rounded-xl border border-border bg-[#2C2C28] text-white p-3 text-xs font-mono max-h-48 overflow-y-auto whitespace-pre-wrap break-all select-all">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(result.rawResponsePreview), null, 2);
                      } catch {
                        return result.rawResponsePreview;
                      }
                    })()}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-border bg-[#FAFAF8]">
          <Button
            variant="outline"
            onClick={onClose}
            className="h-10 min-h-[44px] min-w-[44px] px-5 text-xs font-semibold"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
