import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Browser } from '@capacitor/browser';

/**
 * Helper to download/open files gracefully across Web, iOS, and Android.
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
    try {
        if (!url || typeof url !== 'string' || url === 'undefined' || url.includes('base64,undefined')) {
            throw new Error('Invalid download URL or empty file data payload.');
        }

        if (Capacitor.isNativePlatform()) {
            if (url.startsWith('blob:') || url.startsWith('data:')) {
                // Read blob as base64 if it's a blob URL
                let base64Data = url;
                if (url.startsWith('blob:')) {
                    const response = await fetch(url);
                    const blob = await response.blob();
                    base64Data = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                }

                // Strip data URI scheme prefix (e.g. "data:application/pdf;base64,") so Capacitor Filesystem receives clean raw base64
                const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

                // Write file to device
                const savedFile = await Filesystem.writeFile({
                    path: filename,
                    data: cleanBase64,
                    directory: Directory.Documents,
                    recursive: true
                });
                
                console.log('Saved file:', savedFile.uri);
                alert(`File saved to your device documents: ${filename}`);
                
            } else {
                // For regular URLs, open in system browser which handles downloads natively
                await Browser.open({ url, presentationStyle: 'popover', windowName: '_system' });
            }
        } else {
            // Web fallback: Handle data URI / base64 and blob URLs cleanly
            let blobUrl = url;
            let revokeNeeded = false;

            if (url.startsWith('data:')) {
                try {
                    const arr = url.split(',');
                    if (!arr[1] || arr[1] === 'undefined') {
                        throw new Error('Corrupted or empty data URI content.');
                    }
                    const mimeMatch = arr[0].match(/:(.*?);/);
                    const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
                    const bstr = atob(arr[1]);
                    let n = bstr.length;
                    const u8arr = new Uint8Array(n);
                    while (n--) {
                        u8arr[n] = bstr.charCodeAt(n);
                    }
                    const blob = new Blob([u8arr], { type: mime });
                    blobUrl = URL.createObjectURL(blob);
                    revokeNeeded = true;
                } catch (convErr) {
                    console.warn("Could not convert data URI to blob, falling back to direct href:", convErr);
                    blobUrl = url;
                }
            } else if (url.startsWith('http://') || url.startsWith('https://')) {
                try {
                    const response = await fetch(url);
                    if (response.ok) {
                        const blob = await response.blob();
                        blobUrl = URL.createObjectURL(blob);
                        revokeNeeded = true;
                    }
                } catch (netErr) {
                    console.warn("Cross-origin fetch failed for download, falling back to direct href:", netErr);
                    blobUrl = url;
                }
            }

            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            if (blobUrl.startsWith('http')) {
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
            }
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // Extended revoke timeout to prevent premature revocation during browser disk writes or user "Save As" prompts
            if (revokeNeeded) {
                setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
            }
        }
    } catch (error) {
        console.error('Download failed:', error);
        throw error;
    }
}
