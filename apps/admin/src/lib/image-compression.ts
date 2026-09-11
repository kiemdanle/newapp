const MAX_DIMENSION = 1920;
const QUALITY_STEPS = [0.82, 0.72, 0.70] as const;
const MAX_BYTES = 1 * 1024 * 1024; // 1 MB

export function isWebPSupported(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    return c.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    return false;
  }
}

export async function compressImageForUpload(file: File): Promise<File> {
  const format = isWebPSupported() ? 'image/webp' : 'image/jpeg';
  const extension = format === 'image/webp' ? '.webp' : '.jpg';

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = async () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      if (width <= 0 || height <= 0) {
        return reject(new Error('Image has no readable dimensions'));
      }

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Failed to initialize canvas context for image compression'));
      }

      ctx.drawImage(img, 0, 0, width, height);

      let lastBlob: Blob | null = null;
      for (const q of QUALITY_STEPS) {
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, format, q));
        if (blob) {
          lastBlob = blob;
          if (blob.size <= MAX_BYTES) {
            const newName = file.name.replace(/\.[^/.]+$/, '') + extension;
            return resolve(new File([blob], newName, { type: format }));
          }
        }
      }

      // Fail closed if still > 1 MB after quality 0.70 attempt
      reject(
        new Error(
          `Image is too dense to compress under 1 MB (${Math.round((lastBlob?.size ?? 0) / 1024)} KB at quality 0.70). Please select a clearer photo.`,
        ),
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to decode image file for compression'));
    };

    img.src = url;
  });
}
