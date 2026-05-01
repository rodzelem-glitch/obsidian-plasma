import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { Camera, X } from 'lucide-react';
import Button from './Button';
import Modal from './Modal';

interface BarcodeScannerProps {
    onScan: (decodedText: string) => void;
}

export const BarcodeScannerButton: React.FC<BarcodeScannerProps> = ({ onScan }) => {
    const [isOpen, setIsOpen] = useState(false);
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);

    useEffect(() => {
        if (isOpen) {
            scannerRef.current = new Html5QrcodeScanner(
                "reader",
                { 
                    fps: 10, 
                    qrbox: { width: 250, height: 250 },
                    supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
                    rememberLastUsedCamera: true
                },
                false
            );

            scannerRef.current.render(
                (decodedText) => {
                    if (scannerRef.current) {
                        try {
                            scannerRef.current.clear();
                        } catch (e) { console.error(e); }
                    }
                    onScan(decodedText);
                    setIsOpen(false);
                },
                (error) => {
                    // Ignore transient errors
                }
            );
        } else {
            if (scannerRef.current) {
                try {
                    scannerRef.current.clear();
                } catch (e) { console.error(e); }
                scannerRef.current = null;
            }
        }

        return () => {
            if (scannerRef.current) {
                try {
                    scannerRef.current.clear();
                } catch (e) { console.error(e); }
            }
        };
    }, [isOpen, onScan]);

    return (
        <>
            <Button variant="secondary" onClick={() => setIsOpen(true)} className="flex gap-2 items-center">
                <Camera size={16} /> Scan
            </Button>
            
            <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Scan Barcode">
                <div className="flex flex-col items-center">
                    <div id="reader" className="w-full max-w-[400px]"></div>
                    <Button variant="secondary" className="mt-4 w-full" onClick={() => setIsOpen(false)}>
                        <X size={16} className="inline mr-2" /> Cancel
                    </Button>
                </div>
            </Modal>
        </>
    );
};
