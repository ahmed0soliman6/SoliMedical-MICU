/**
 * Safely scales down high-resolution phone/camera images to an optimal size for OCR (max 1600px).
 * Reduces payload from 15-30MB to ~250-400KB, preventing HTTP timeouts, proxy drops, and "Failed to fetch" errors.
 */
export async function compressImageForOcr(
  fileOrBase64: File | string,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.85
): Promise<{ base64: string; mimeType: string }> {
  // If it's already an SVG data URL (like demo sample printouts), return as-is
  if (typeof fileOrBase64 === 'string' && fileOrBase64.startsWith('data:image/svg+xml')) {
    return { base64: fileOrBase64, mimeType: 'image/svg+xml' };
  }

  return new Promise((resolve) => {
    const img = new Image();
    
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions preserving aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // High quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve({ base64: compressedBase64, mimeType: 'image/jpeg' });
      } else {
        if (typeof fileOrBase64 === 'string') {
          resolve({ base64: fileOrBase64, mimeType: 'image/jpeg' });
        } else {
          const reader = new FileReader();
          reader.onload = (e) => resolve({ base64: (e.target?.result as string) || '', mimeType: fileOrBase64.type || 'image/jpeg' });
          reader.readAsDataURL(fileOrBase64);
        }
      }
    };

    img.onerror = () => {
      if (typeof fileOrBase64 === 'string') {
        resolve({ base64: fileOrBase64, mimeType: 'image/jpeg' });
      } else {
        const reader = new FileReader();
        reader.onload = (e) => resolve({ base64: (e.target?.result as string) || '', mimeType: fileOrBase64.type || 'image/jpeg' });
        reader.readAsDataURL(fileOrBase64);
      }
    };

    if (typeof fileOrBase64 === 'string') {
      img.src = fileOrBase64;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = (e.target?.result as string) || '';
      };
      reader.readAsDataURL(fileOrBase64);
    }
  });
}
