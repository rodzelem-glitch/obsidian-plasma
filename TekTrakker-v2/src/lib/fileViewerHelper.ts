import { Capacitor } from '@capacitor/core';

/**
 * Universal File & Document Preview Helper
 * Detects MIME types and extensions reliably across Firebase Storage URLs (with query params),
 * base64 data URIs, Google Cloud Storage URLs, and raw file names.
 */

export interface FileTypeInfo {
    isPdf: boolean;
    isImage: boolean;
    isHtml: boolean;
    isOfficeDoc: boolean;
    isVideo: boolean;
    isAudio: boolean;
    isText: boolean;
    extension: string;
    resolvedUrl: string;
    googleDocsViewerUrl: string | null;
    /** The optimal URL to use inside an iframe. On mobile/Capacitor, routes PDFs via Google Docs Viewer to avoid blank iframe bugs. */
    previewUrl: string;
}

/**
 * Detects if the current environment is a mobile device or native mobile app (Capacitor/WebView)
 * where iframes do not have a built-in PDF viewer plugin.
 */
export function isMobileOrNative(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
            return true;
        }
    } catch (_) {}

    if (typeof navigator !== 'undefined') {
        const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
        if (/android|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(ua)) {
            return true;
        }
        if (navigator.maxTouchPoints > 1 && /macintosh/i.test(ua)) {
            return true;
        }
    }

    if (window.innerWidth <= 768 && ('ontouchstart' in window || (navigator && navigator.maxTouchPoints > 0))) {
        return true;
    }

    return false;
}

export function detectFileType(
    urlOrDataUrl?: string | null,
    fileName?: string | null,
    declaredMimeType?: string | null,
    options?: { forceGoogleDocsViewer?: boolean; forceDirectViewer?: boolean }
): FileTypeInfo {
    const rawUrl = (urlOrDataUrl || '').trim();
    const rawName = (fileName || '').trim();
    const rawMime = (declaredMimeType || '').toLowerCase().trim();

    // Strip query parameters to inspect clean file extension (e.g. Firebase storage ?alt=media&token=...)
    let cleanPath = '';
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
        try {
            const parsed = new URL(rawUrl);
            cleanPath = decodeURIComponent(parsed.pathname.toLowerCase());
        } catch {
            cleanPath = rawUrl.split('?')[0].toLowerCase();
        }
    } else {
        cleanPath = rawUrl.split('?')[0].toLowerCase();
    }

    const nameLower = rawName.toLowerCase();

    // Extract extension
    let extension = '';
    const extMatch = cleanPath.match(/\.([a-z0-9]+)$/i) || nameLower.match(/\.([a-z0-9]+)$/i);
    if (extMatch) {
        extension = extMatch[1].toLowerCase();
    }

    const isPdf = rawUrl.startsWith('data:application/pdf') || 
                  rawMime.includes('pdf') || 
                  extension === 'pdf' || 
                  cleanPath.endsWith('.pdf') || 
                  nameLower.endsWith('.pdf') ||
                  cleanPath.includes('/pdf') || 
                  cleanPath.includes('%2fpdf');

    const isImage = rawUrl.startsWith('data:image/') || 
                    rawMime.includes('image') || 
                    ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic', 'bmp', 'ico', 'avif'].includes(extension) ||
                    /\.(jpg|jpeg|png|gif|webp|svg|heic|bmp|ico|avif)$/i.test(cleanPath) ||
                    /\.(jpg|jpeg|png|gif|webp|svg|heic|bmp|ico|avif)$/i.test(nameLower);

    const isHtml = rawUrl.startsWith('data:text/html') || 
                   rawMime.includes('html') || 
                   ['html', 'htm'].includes(extension) ||
                   cleanPath.endsWith('.html') || 
                   cleanPath.endsWith('.htm') ||
                   nameLower.endsWith('.html') || 
                   nameLower.endsWith('.htm');

    const isOfficeDoc = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'rtf'].includes(extension) ||
                        /\.(doc|docx|xls|xlsx|ppt|pptx|csv|rtf)$/i.test(cleanPath) ||
                        /\.(doc|docx|xls|xlsx|ppt|pptx|csv|rtf)$/i.test(nameLower) ||
                        rawMime.includes('word') || rawMime.includes('excel') || rawMime.includes('spreadsheet') || rawMime.includes('presentation');

    const isVideo = rawUrl.startsWith('data:video/') || 
                    rawMime.includes('video') || 
                    ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(extension);

    const isAudio = rawUrl.startsWith('data:audio/') || 
                    rawMime.includes('audio') || 
                    ['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(extension);

    const isText = rawUrl.startsWith('data:text/plain') || 
                   rawMime.includes('text/plain') || 
                   ['txt', 'log', 'json', 'xml', 'md'].includes(extension);

    const isWebUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://');
    const googleDocsViewerUrl = isWebUrl && (isOfficeDoc || isPdf) 
        ? `https://docs.google.com/viewer?url=${encodeURIComponent(rawUrl)}&embedded=true` 
        : null;

    // For PDFs on mobile/native WebViews (Android Capacitor, etc.):
    // The native WebView has no built-in PDF viewer plugin inside iframes and shows a blank box.
    // When a public web URL is available, we route through Google Docs Viewer so the PDF renders inline.
    // On desktop browsers with built-in PDFium/PDF viewer plugins, direct URL is used for full fidelity.
    let previewUrl = rawUrl;
    if (options?.forceGoogleDocsViewer && googleDocsViewerUrl) {
        previewUrl = googleDocsViewerUrl;
    } else if (options?.forceDirectViewer) {
        previewUrl = rawUrl;
    } else if (isPdf && googleDocsViewerUrl && isMobileOrNative()) {
        previewUrl = googleDocsViewerUrl;
    } else if (isOfficeDoc && googleDocsViewerUrl) {
        previewUrl = googleDocsViewerUrl;
    }

    return {
        isPdf,
        isImage,
        isHtml,
        isOfficeDoc,
        isVideo,
        isAudio,
        isText,
        extension,
        resolvedUrl: rawUrl,
        googleDocsViewerUrl,
        previewUrl
    };
}
