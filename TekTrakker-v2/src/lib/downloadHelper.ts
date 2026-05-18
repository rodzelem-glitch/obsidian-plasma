import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Browser } from '@capacitor/browser';

/**
 * Helper to download/open files gracefully across Web, iOS, and Android.
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
    try {
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

                // Write file to device
                const savedFile = await Filesystem.writeFile({
                    path: filename,
                    data: base64Data,
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
            // Web fallback
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    } catch (error) {
        console.error('Download failed:', error);
        alert('Failed to download the file.');
    }
}
