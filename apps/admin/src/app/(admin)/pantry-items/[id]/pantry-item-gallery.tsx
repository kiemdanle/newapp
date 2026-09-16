'use client';

import { useState } from 'react';
import { Package, Image as ImageIcon } from 'lucide-react';

export function PantryItemGallery({
  photos,
  title,
}: {
  photos: string[];
  title: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/50 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 text-neutral-400 mb-2">
          <ImageIcon size={24} />
        </div>
        <p className="text-xs font-medium text-neutral-500">No photos uploaded for this item</p>
      </div>
    );
  }

  const currentPhoto = photos[selectedIndex] ?? photos[0];

  return (
    <div className="space-y-3">
      {/* Main Preview */}
      <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-neutral-100 border border-border shadow-xs">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentPhoto}
          alt={title}
          className="h-full w-full object-contain bg-black/5"
        />
      </div>

      {/* Thumbnails */}
      {photos.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {photos.map((url, idx) => (
            <button
              key={url + idx}
              type="button"
              onClick={() => setSelectedIndex(idx)}
              className={`relative h-16 w-16 shrink-0 rounded-xl overflow-hidden border-2 transition ${
                selectedIndex === idx
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`${title} ${idx + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
