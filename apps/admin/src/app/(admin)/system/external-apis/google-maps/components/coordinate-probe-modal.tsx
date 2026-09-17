'use client';

import React, { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Compass,
  X,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  MapPin,
} from 'lucide-react';
import type { GoogleMapsProbeResponse } from '@expyrico/shared';

const SAMPLE_COORDS = [
  { name: 'Ho Chi Minh City, VN', lat: 10.7769, lng: 106.7009 },
  { name: 'Orchard, Singapore', lat: 1.3048, lng: 103.8318 },
  { name: 'Central Park, NY', lat: 40.785091, lng: -73.968285 },
  { name: 'London Eye, UK', lat: 51.5033, lng: -0.1195 },
];

export function CoordinateProbeModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [lat, setLat] = useState<string>('10.7769');
  const [lng, setLng] = useState<string>('106.7009');
  const [result, setResult] = useState<GoogleMapsProbeResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRunProbe = () => {
    setErr(null);
    setResult(null);

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
      setErr('Latitude must be between -90 and 90.');
      return;
    }
    if (isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180) {
      setErr('Longitude must be between -180 and 180.');
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/proxy-probe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ latitude: parsedLat, longitude: parsedLng }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || `Probe failed with status ${res.status}`);
        }

        const data = (await res.json()) as GoogleMapsProbeResponse;
        setResult(data);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : 'Failed to execute probe');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-neutral-light shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-light flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass size={18} className="text-primary" />
            <h3 className="font-bold text-neutral-dark text-base">Reverse Geocode Probe</h3>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-mid hover:text-neutral-dark p-1 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-neutral-mid">
            Test live reverse geocoding for any coordinates to inspect address extraction, country resolution, and latency.
          </p>

          {/* Preset Buttons */}
          <div>
            <label className="text-[11px] font-semibold text-neutral-mid uppercase tracking-wider block mb-1.5">
              Sample Coordinates
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_COORDS.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => {
                    setLat(String(s.lat));
                    setLng(String(s.lng));
                    setResult(null);
                    setErr(null);
                  }}
                  className="text-xs bg-neutral-light/50 hover:bg-neutral-light px-2.5 py-1 rounded-lg border border-neutral-light text-neutral-dark font-medium transition"
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          {/* Coordinate Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-neutral-dark block mb-1">
                Latitude (-90 to 90)
              </label>
              <input
                type="text"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="10.7769"
                className="w-full text-sm font-mono border border-neutral-mid/30 rounded-xl px-3 py-2 focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-dark block mb-1">
                Longitude (-180 to 180)
              </label>
              <input
                type="text"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="106.7009"
                className="w-full text-sm font-mono border border-neutral-mid/30 rounded-xl px-3 py-2 focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

          {/* Error Banner */}
          {err && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{err}</span>
            </div>
          )}

          {/* Result Card */}
          {result && (
            <div className="bg-neutral-light/40 border border-neutral-light rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 size={14} />
                  Resolution Successful
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-mid flex items-center gap-1 font-mono">
                    <Clock size={12} />
                    {result.durationMs} ms
                  </span>
                  {result.cached && (
                    <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold border border-blue-200 flex items-center gap-1">
                      <Zap size={10} />
                      Cached
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-medium text-neutral-mid block">
                  Formatted Neighbourhood & City
                </span>
                <p className="text-sm font-semibold text-neutral-dark flex items-start gap-1.5">
                  <MapPin size={14} className="text-primary shrink-0 mt-0.5" />
                  <span>{result.formattedAddress}</span>
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs pt-1 border-t border-neutral-light text-neutral-mid">
                <span>Country Code: <strong className="text-neutral-dark font-mono">{result.countryCode}</strong></span>
                <span>Coordinates: <strong className="text-neutral-dark font-mono">{result.latitude}, {result.longitude}</strong></span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-neutral-light/20 border-t border-neutral-light flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Close
          </Button>
          <Button
            onClick={handleRunProbe}
            disabled={pending}
            className="bg-primary hover:bg-primary-dark text-white gap-2 font-semibold"
          >
            <Play size={14} />
            <span>{pending ? 'Probing…' : 'Execute Probe'}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
