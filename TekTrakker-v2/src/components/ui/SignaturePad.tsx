import React, { useRef, useImperativeHandle, forwardRef } from 'react';
// @ts-ignore
import SignatureCanvas from 'react-signature-canvas';

export interface SignaturePadHandle {
    clear: () => void;
    isEmpty: () => boolean;
    toDataURL: () => string;
}

interface SignaturePadProps {
    className?: string;
    onEnd?: (dataUrl: string) => void; // Add onEnd prop
}

const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(({ className, onEnd }, ref) => {
    const sigCanvas = useRef<any>(null);

    useImperativeHandle(ref, () => ({
        clear: () => {
            sigCanvas.current?.clear();
            onEnd?.(''); // Clear signature data when cleared
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

    return (
        <div className={`border border-gray-300 dark:border-gray-600 rounded bg-white touch-none ${className}`}>
            <SignatureCanvas 
                ref={sigCanvas}
                penColor="black"
                canvasProps={{ className: 'w-full h-40' }} 
                onEnd={handleEnd} // Pass the handleEnd function to onEnd
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
