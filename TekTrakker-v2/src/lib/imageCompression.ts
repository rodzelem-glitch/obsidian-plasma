/**
 * High-Performance Client-Side Image Compression Utility
 * 
 * Automatically scales down multi-megapixel mobile camera photos (e.g. 12MP-48MP / 8MB-15MB)
 * to crisp, web-optimized service documentation images (typically ~150KB - 350KB).
 * 
 * Benefits:
 * - 95%+ reduction in mobile data usage.
 * - 10x-20x faster uploads on cellular LTE/5G connections.
 * - Prevents Firestore document bloat, memory exhaustion, and mobile UI freezing.
 */

export interface CompressionOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    maxSizeKB?: number;
    targetFormat?: 'image/jpeg' | 'image/webp';
}

/**
 * Compresses a DOM File object (from file picker or camera) using HTML5 Canvas.
 */
export const compressImageFile = async (
    file: File,
    options: CompressionOptions = {}
): Promise<File> => {
    // If not an image or is SVG / animated GIF / small file, skip compression
    if (!file.type || !file.type.startsWith('image/') || file.type.includes('svg') || file.type.includes('gif')) {
        return file;
    }

    // Skip if file is already tiny (< 250 KB)
    if (file.size <= 250 * 1024) {
        return file;
    }

    const maxWidth = options.maxWidth || 1920;
    const maxHeight = options.maxHeight || 1920;
    const quality = options.quality ?? 0.82;
    const format = options.targetFormat || 'image/jpeg';

    return new Promise((resolve) => {
        let objectUrl: string | null = null;
        try {
            if (typeof URL !== 'undefined' && URL.createObjectURL) {
                objectUrl = URL.createObjectURL(file);
            }
        } catch {
            // fallback to FileReader below if createObjectURL is not supported
        }

        const cleanup = () => {
            if (objectUrl) {
                try {
                    URL.revokeObjectURL(objectUrl);
                } catch {
                    /* ignore */
                }
                objectUrl = null;
            }
        };

        const onImageReady = (img: HTMLImageElement) => {
            let { width, height } = img;

            // Scale down dimensions while preserving aspect ratio
            if (width > maxWidth || height > maxHeight) {
                if (width > height) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                } else {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d', { alpha: false });
            if (!ctx) {
                cleanup();
                resolve(file);
                return;
            }

            // Render crisp background for transparency handling
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                (blob) => {
                    cleanup();
                    // Explicitly purge GPU canvas buffer
                    canvas.width = 0;
                    canvas.height = 0;

                    if (!blob || blob.size >= file.size) {
                        // If compression somehow didn't reduce file size, return original
                        resolve(file);
                        return;
                    }

                    const newFileName = file.name.replace(/\.[^.]+$/, format === 'image/webp' ? '.webp' : '.jpg');
                    const compressedFile = new File(
                        [blob],
                        newFileName,
                        { type: format, lastModified: Date.now() }
                    );
                    resolve(compressedFile);
                },
                format,
                quality
            );
        };

        if (objectUrl) {
            const img = new Image();
            img.onload = () => onImageReady(img);
            img.onerror = () => {
                cleanup();
                resolve(file);
            };
            img.src = objectUrl;
        } else {
            // Safe fallback to FileReader if createObjectURL is unavailable
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => onImageReady(img);
                img.onerror = () => resolve(file);
                img.src = e.target?.result as string;
            };
            reader.onerror = () => resolve(file);
            reader.readAsDataURL(file);
        }
    });
};

/**
 * Compresses a Base64 data URL string (e.g. from WebCamera or Capacitor Camera).
 */
export const compressDataUrl = async (
    dataUrl: string,
    options: CompressionOptions = {}
): Promise<string> => {
    if (!dataUrl || !dataUrl.startsWith('data:image/') || dataUrl.startsWith('data:image/svg') || dataUrl.startsWith('data:image/gif')) {
        return dataUrl;
    }

    // Skip if base64 length is already small (< 300KB equivalent)
    if (dataUrl.length < 400000) {
        return dataUrl;
    }

    const maxWidth = options.maxWidth || 1920;
    const maxHeight = options.maxHeight || 1920;
    const quality = options.quality ?? 0.82;
    const format = options.targetFormat || 'image/jpeg';

    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            let { width, height } = img;

            if (width > maxWidth || height > maxHeight) {
                if (width > height) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                } else {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d', { alpha: false });
            if (!ctx) {
                resolve(dataUrl);
                return;
            }

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            const compressed = canvas.toDataURL(format, quality);
            canvas.width = 0;
            canvas.height = 0;
            resolve(compressed.length < dataUrl.length ? compressed : dataUrl);
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
};
