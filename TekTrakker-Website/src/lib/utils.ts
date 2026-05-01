
import { Address } from '../types/organization';

// Simple image compression utility using canvas
export const compressFile = (file: File, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
        const isImage = file.type.startsWith('image/');
        // For non-image files, just read as Base64 without compression
        if (!isImage) {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Resize logic: Max 1024px dimension
                const MAX_DIM = 1024;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_DIM) {
                        height *= MAX_DIM / width;
                        width = MAX_DIM;
                    }
                } else {
                    if (height > MAX_DIM) {
                        width *= MAX_DIM / height;
                        height = MAX_DIM;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                ctx?.drawImage(img, 0, 0, width, height);

                // Get the data-URL with the specified quality
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};

export const formatAddress = (address: string | Address | undefined | null): string => {
    if (!address) return '';
    if (typeof address === 'string') return address;
    return `${address.street}, ${address.city}, ${address.state} ${address.zip}`;
};

export const getBaseUrl = (): string => {
    const { hostname, protocol, origin } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || protocol === 'capacitor:') {
        return 'https://app.tektrakker.com';
    }
    return origin;
};

