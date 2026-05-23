import React, { useRef, useImperativeHandle, forwardRef, useState, useEffect } from 'react';
import SignatureCanvasModule from 'react-signature-canvas';
const SignatureCanvas = (SignatureCanvasModule as any).default || SignatureCanvasModule;

export interface SignaturePadHandle {
    clear: () => void;
    isEmpty: () => boolean;
    toDataURL: () => string;
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
        isEmpty: () => sigCanvas.current?.isEmpty(),
        toDataURL: () => sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png')
    }));

    const handleEnd = () => {
        if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
            onEnd?.(sigCanvas.current.getTrimmedCanvas().toDataURL('image/png'));
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
            if (canvasEl) {
                const w = canvasEl.clientWidth || width || 400;
                const h = canvasEl.clientHeight || 160;
                setCanvasSize({ width: w, height: h });
            } else {
                setCanvasSize({ width: width || 400, height: 160 });
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