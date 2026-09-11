'use client';
import { useState, useRef, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  reorderProductPhotosAction,
  removeProductPhotoAction,
  uploadProductPhotoAction,
} from '@/lib/actions';
import { actionErrorMessage, isConflictCode } from '@/lib/action-result';
import { resolveAdminPhotoUrl } from '@/lib/admin-media';
import { compressImageForUpload } from '@/lib/image-compression';
import {
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
  Trash2,
  RefreshCw,
  UploadCloud,
  Star,
  Loader2,
  Plus,
} from 'lucide-react';

interface Photo {
  id: string;
  position: number;
  thumbnailUrl: string;
  displayUrl: string;
}
const MAX_RAW_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB raw input ceiling
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export function ProductPhotoManager({
  productId,
  photos,
  maxPhotos = 5,
}: {
  productId: string;
  photos: Photo[];
  maxPhotos?: number;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [order, setOrder] = useState(() => [...photos].sort((a, b) => a.position - b.position));
  const [err, setErr] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  function persistOrder(next: Photo[]) {
    const previousOrder = [...order];
    setOrder(next);
    setErr(null);
    setConflict(false);
    startTransition(async () => {
      const photoIds = next.map((p) => p.id);
      const res = await reorderProductPhotosAction(productId, photoIds);
      if (res.ok && res.data && Array.isArray(res.data.photos)) {
        setOrder([...res.data.photos].sort((a, b) => a.position - b.position));
      } else if (!res.ok) {
        setOrder(previousOrder);
        setErr(actionErrorMessage(res));
        if (isConflictCode(res.code)) setConflict(true);
      }
    });
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target]!, next[index]!];
    persistOrder(next);
  }

  function setAsCover(photoId: string) {
    const target = order.find((p) => p.id === photoId);
    if (!target) return;
    const remaining = order.filter((p) => p.id !== photoId);
    const next = [target, ...remaining];
    persistOrder(next);
  }

  function remove(photoId: string) {
    if (!window.confirm('Delete this photo from the product?')) return;
    const previousOrder = [...order];
    setOrder((prev) => prev.filter((p) => p.id !== photoId));
    setErr(null);
    setConflict(false);
    startTransition(async () => {
      const res = await removeProductPhotoAction(productId, photoId);
      if (res.ok && res.data && Array.isArray(res.data.photos)) {
        setOrder([...res.data.photos].sort((a, b) => a.position - b.position));
      } else if (!res.ok) {
        setOrder(previousOrder);
        setErr(actionErrorMessage(res));
        if (isConflictCode(res.code)) setConflict(true);
      }
    });
  }

  async function handleFiles(fileList: FileList | File[]) {
    setErr(null);
    const files = Array.from(fileList);
    if (files.length === 0) return;

    // Filter and validate MIME types
    const invalidTypes = files.filter((f) => !ALLOWED_MIME_TYPES.includes(f.type));
    if (invalidTypes.length > 0) {
      setErr('Unsupported file type(s). Only JPEG, PNG, and WebP images are allowed.');
      return;
    }

    // Filter and validate file size (25MB raw ceiling)
    const oversized = files.filter((f) => f.size > MAX_RAW_FILE_SIZE_BYTES);
    if (oversized.length > 0) {
      setErr('Some images exceed the maximum allowed raw size of 25 MB.');
      return;
    }

    // Check available photo slots
    const availableSlots = maxPhotos - order.length;
    if (availableSlots <= 0) {
      setErr(`Maximum limit of ${maxPhotos} photos reached for this product.`);
      return;
    }

    const filesToUpload = files.slice(0, availableSlots);
    if (files.length > availableSlots) {
      setErr(`Only ${availableSlots} more photo(s) can be added (max ${maxPhotos}).`);
    }
    setUploading(true);
    let latestPhotos: Photo[] = order;

    try {
      // Pass 1: In-browser background auto-compression
      const compressedFiles: File[] = [];
      for (let i = 0; i < filesToUpload.length; i++) {
        setUploadProgress(`Compressing photo ${i + 1} of ${filesToUpload.length}…`);
        const compressed = await compressImageForUpload(filesToUpload[i]!);
        compressedFiles.push(compressed);
      }

      // Pass 2: Sequential upload to server
      for (let i = 0; i < compressedFiles.length; i++) {
        const file = compressedFiles[i]!;
        setUploadProgress(`Uploading photo ${i + 1} of ${compressedFiles.length}…`);

        const formData = new FormData();
        formData.append('file', file);

        const res = await uploadProductPhotoAction(productId, formData);
        if (res.ok && res.data && Array.isArray(res.data.photos)) {
          latestPhotos = [...res.data.photos].sort((a, b) => a.position - b.position);
          setOrder(latestPhotos);
        } else if (!res.ok) {
          setErr(actionErrorMessage(res));
          if (isConflictCode(res.code)) setConflict(true);
          break;
        }
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Network error during upload. Please retry.');
    } finally {
      setUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      router.refresh();
    }
  }

  useEffect(() => {
    if (!uploading && !pending) {
      setOrder([...photos].sort((a, b) => a.position - b.position));
    }
  }, [photos, uploading, pending]);

  return (
    <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-card space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-base font-bold text-neutral-dark font-display">
              Photo Gallery Manager ({order.length} / {maxPhotos})
            </h2>
            <p className="text-xs text-neutral-mid">
              Position 0 serves as the primary catalog cover image. Reorder or click &quot;Set as Cover&quot; to change.
            </p>
          </div>
        </div>

        {order.length < maxPhotos && (
          <Button
            size="sm"
            disabled={pending || uploading}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl gap-1.5 shadow-xs self-start sm:self-auto"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            <span>Upload photos</span>
          </Button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
        }}
      />
      {/* Upload Dropzone */}
      {order.length < maxPhotos && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
          }}
          onClick={() => {
            if (!uploading) fileInputRef.current?.click();
          }}
          className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
            isDragging
              ? 'border-primary bg-primary/10 text-primary scale-[0.99]'
              : 'border-border hover:border-primary/50 hover:bg-neutral-light/40 text-neutral-mid'
          } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2 text-primary">
              <Loader2 size={24} className="animate-spin" />
              <span className="text-xs font-semibold">{uploadProgress}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-center">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-1">
                <UploadCloud size={20} />
              </div>
              <p className="text-xs font-semibold text-neutral-dark">
                Drag &amp; drop product images here, or <span className="text-primary underline">browse</span>
              </p>
              <p className="text-[11px] text-neutral-mid">
                Supports JPEG, PNG, and WebP up to 25 MB raw (auto-compressed to &lt; 1 MB). ({maxPhotos - order.length} slots remaining)
              </p>
            </div>
          )}
        </div>
      )}

      {/* Gallery Grid */}
      {order.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 rounded-2xl border border-dashed border-neutral-200 text-neutral-mid text-xs">
          <ImageIcon size={28} className="mb-2 text-neutral-mid/50" />
          <span>No photos.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {order.map((photo, i) => (
            <div
              key={photo.id}
              className={`group relative rounded-2xl border bg-white p-3 shadow-2xs hover:shadow-xs transition-all space-y-2.5 ${
                i === 0 ? 'border-primary/50 ring-1 ring-primary/30' : 'border-neutral-200/80'
              }`}
            >
              <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-neutral-light/50 border border-neutral-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolveAdminPhotoUrl('product', productId, photo, 'thumb')}
                  alt={i === 0 ? 'Cover photo' : `Photo ${i + 1}`}
                  className="h-full w-full object-cover"
                />
                <span
                  className={`absolute top-2 left-2 rounded-md px-2 py-0.5 text-[10px] font-bold text-white shadow-xs ${
                    i === 0 ? 'bg-primary' : 'bg-neutral-dark/80'
                  }`}
                >
                  {i === 0 ? 'Cover Photo' : `Position ${i}`}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="space-y-1.5 pt-1 border-t border-neutral-100">
                {i > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending || uploading}
                    onClick={() => setAsCover(photo.id)}
                    className="w-full h-7 rounded-lg text-[11px] gap-1 text-primary border-primary/30 hover:bg-primary/5 font-medium"
                    title="Promote to cover photo (Position 0)"
                  >
                    <Star size={11} className="fill-primary/20" />
                    <span>Set as Cover</span>
                  </Button>
                )}

                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending || uploading || i === 0}
                      onClick={() => move(i, -1)}
                      className="h-7 w-7 p-0 rounded-lg"
                      title="Move photo earlier"
                      aria-label="Move photo earlier"
                    >
                      <ArrowUp size={13} />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending || uploading || i === order.length - 1}
                      onClick={() => move(i, 1)}
                      className="h-7 w-7 p-0 rounded-lg"
                      title="Move photo later"
                      aria-label="Move photo later"
                    >
                      <ArrowDown size={13} />
                    </Button>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={pending || uploading}
                    onClick={() => remove(photo.id)}
                    className="h-7 w-7 p-0 rounded-lg text-red-600 hover:bg-red-50"
                    title="Remove photo"
                    aria-label="Remove photo"
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error Alert */}
      {err && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-red-50 p-3 text-xs text-destructive border border-red-200/80">
          <span>{err}</span>
          {conflict && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 rounded-lg text-xs"
              onClick={() => router.refresh()}
            >
              <RefreshCw size={12} className="mr-1" />
              <span>Refresh</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
