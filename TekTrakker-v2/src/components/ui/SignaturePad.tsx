import React, { useRef, useImperativeHandle, forwardRef, useState, useEffect } from 'react';
import SignatureCanvasModule from 'react-signature-canvas';
const SignatureCanvas = (SignatureCanvasModule as any).default || SignatureCanvasModule;

export interface SignaturePadHandle {
    clear: () => void;
    isEmpty: () => boolean;
    toDataURL: (type?: string, encoderOptions?: number) => string;
    getTrimmedCanvas: () => any;
}

interface SignaturePadProps {
    className?: string;
    onEnd?: (dataUrl: string) => void;
}

const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(({ className, onEnd }, ref) => {
    const sigCanvas = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

    useImperativeHandle(ref, () => ({
        clear: () => {
            sigCanvas.current?.clear();
            onEnd?.('');
        },
        isEmpty: () => !sigCanvas.current || sigCanvas.current.isEmpty(),
        toDataURL: (type?: string, encoderOptions?: number) => {
            try {
                if (!sigCanvas.current || sigCanvas.current.isEmpty()) return '';
                return sigCanvas.current.getTrimmedCanvas().toDataURL(type || 'image/png', encoderOptions);
            } catch (err) {
                try {
                    return sigCanvas.current?.getCanvas?.()?.toDataURL(type || 'image/png', encoderOptions) || '';
                } catch (err2) {
                    return '';
                }
            }
        },
        getTrimmedCanvas: () => {
            if (!sigCanvas.current || sigCanvas.current.isEmpty()) return null;
            return sigCanvas.current.getTrimmedCanvas();
        }
    }));

    const handleEnd = () => {
        if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
            try {
                const trimmed = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
                onEnd?.(trimmed);
            } catch (err) {
                const fallback = sigCanvas.current?.getCanvas?.()?.toDataURL('image/png') || '';
                onEnd?.(fallback);
            }
        } else {
            onEnd?.('');
        }
    };

    useEffect(() => {
        if (!containerRef.current) return;

        const updateSize = () => {
            const container = containerRef.current;
            if (!container) return;

            const width = container.clientWidth;
            const canvasEl = container.querySelector('canvas');
            const w = canvasEl?.clientWidth || width || 400;
            const h = canvasEl?.clientHeight || 160;

            // Preserve existing stroke data across canvas dimension adjustments
            const existingPoints = (sigCanvas.current && !sigCanvas.current.isEmpty())
                ? sigCanvas.current.toData()
                : null;

            setCanvasSize(prev => {
                if (prev.width === w && prev.height === h) return prev;
                return { width: w, height: h };
            });

            if (existingPoints && sigCanvas.current) {
                requestAnimationFrame(() => {
                    sigCanvas.current?.fromData(existingPoints);
                });
            }
        };

        updateSize();

        const resizeObserver = new ResizeObserver(() => {
            updateSize();
        });
        resizeObserver.observe(containerRef.current);

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    return (
        <div 
            ref={containerRef}
            className={`border border-gray-300 dark:border-gray-600 rounded bg-white touch-none ${className}`}
        >
            <SignatureCanvas 
                ref={sigCanvas}
                penColor="black"
                canvasProps={{ 
                    width: canvasSize.width || undefined,
                    height: canvasSize.height || undefined,
                    className: 'w-full h-40 block', 
                    willReadFrequently: true 
                }} 
                onEnd={handleEnd}
            />
            <div className="border-t border-gray-200 p-2 flex justify-end">
                <button 
                    type="button" 
                    onClick={() => sigCanvas.current?.clear()} 
                    className="text-xs text-red-500 hover:underline"
                >
                    Clear Signature
                </button>
            </div>
        </div>
    );
});

export default SignaturePad;