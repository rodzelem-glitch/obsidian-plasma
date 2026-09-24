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
}

export function detectFileType(
    urlOrDataUrl?: string | null,
    fileName?: string | null,
    declaredMimeType?: string | null
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
    const googleDocsViewerUrl = isWebUrl && isOfficeDoc 
        ? `https://docs.google.com/viewer?url=${encodeURIComponent(rawUrl)}&embedded=true` 
        : null;

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
        googleDocsViewerUrl
    };
}
