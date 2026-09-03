'use client';

import { useState } from 'react';
import type { FeedbackAttachment } from '@expyrico/shared';
import { FileText, Image as ImageIcon, ExternalLink, X } from 'lucide-react';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FeedbackAttachments({
  attachments,
}: {
  attachments: FeedbackAttachment[];
}) {
  const [activeImage, setActiveImage] = useState<string | null>(null);

  if (!attachments || attachments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-mid font-display">
        Attached Files & Screenshots ({attachments.length})
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {attachments.map((att) => {
          const isImage = att.mimeType.startsWith('image/');
          const mediaUrl = `/api/admin-feedback-media/${att.id}`;
          return (
            <div
              key={att.id}
              className="group relative rounded-2xl border border-border bg-card p-3 shadow-xs hover:border-primary/40 hover:shadow-card transition-all flex flex-col justify-between overflow-hidden"
            >
              {isImage ? (
                <div
                  onClick={() => setActiveImage(mediaUrl)}
                  className="aspect-video w-full rounded-xl bg-neutral-light overflow-hidden flex items-center justify-center cursor-pointer mb-2 relative"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mediaUrl}
                    alt={att.fileName}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <ExternalLink
                      size={18}
                      className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md"
                    />
                  </div>
                </div>
              ) : (
                <div className="aspect-video w-full rounded-xl bg-neutral-light flex flex-col items-center justify-center mb-2 text-neutral-mid">
                  <FileText size={24} className="text-primary mb-1" />
                  <span className="text-[10px] font-mono uppercase">{att.mimeType.split('/')[1]}</span>
                </div>
              )}

              <div className="min-w-0">
                <p className="text-xs font-semibold text-neutral-dark truncate" title={att.fileName}>
                  {att.fileName}
                </p>
                <div className="flex items-center justify-between mt-0.5 text-[10px] text-neutral-mid">
                  <span>{formatBytes(att.fileSizeBytes)}</span>
                  <a
                    href={mediaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-0.5"
                  >
                    <span>View</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Fullscreen Lightbox Modal */}
      {activeImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
          onClick={() => setActiveImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-neutral-dark p-2">
            <button
              onClick={() => setActiveImage(null)}
              className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black transition-colors"
              aria-label="Close preview"
            >
              <X size={18} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeImage}
              alt="Attachment enlarged"
              className="max-h-[85vh] w-auto max-w-full rounded-xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
