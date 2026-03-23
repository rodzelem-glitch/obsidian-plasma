
import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { Camera, XCircle } from 'lucide-react';

interface BarcodeScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (decodedText: string) => void;
}

const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({ isOpen, onClose, onScan }) => {
    const [error, setError] = useState<string | null>(null);
    const [isScannerStarted, setIsScannerStarted] = useState(false);
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

    const stopScanner = async () => {
        if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
            try {
                await html5QrCodeRef.current.stop();
                setIsScannerStarted(false);
            } catch (err) {
                console.error("Failed to stop scanner", err);
            }
        }
    };

    useEffect(() => {
        if (isOpen) {
            const startScanner = async () => {
                setError(null);
                try {
                    // Initialize the instance
                    const html5QrCode = new Html5Qrcode("reader");
                    html5QrCodeRef.current = html5QrCode;

                    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

                    await html5QrCode.start(
                        { facingMode: "environment" },
                        config,
                        (decodedText) => {
                            onScan(decodedText);
                            stopScanner().then(() => onClose());
                        },
                        (errorMessage) => {
                            // Suppress verbose frame errors
                        }
                    );
                    setIsScannerStarted(true);
                } catch (err: any) {
                    console.error("Scanner start error:", err);
                    setError(err.message || "Could not access camera for scanning.");
                }
            };

            // Small delay to ensure DOM is ready
            const timer = setTimeout(startScanner, 300);
            return () => {
                clearTimeout(timer);
                stopScanner();
            };
        }
    }, [isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={() => { stopScanner().then(() => onClose()); }} title="Scan Barcode / Part">
            <div className="space-y-4">
                <div className="relative w-full aspect-square md:aspect-video bg-black rounded-lg overflow-hidden shadow-inner flex items-center justify-center">
                    <div id="reader" className="w-full h-full"></div>
                    
                    {!isScannerStarted && !error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-slate-900/50">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-2"></div>
                            <p className="text-xs font-bold uppercase tracking-widest">Initializing Camera...</p>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900">
                            <XCircle className="text-red-500 mb-2" size={48} />
                            <p className="text-white text-sm font-bold mb-4">{error}</p>
                            <Button onClick={() => window.location.reload()} className="bg-primary-600">Retry Permissions</Button>
                        </div>
                    )}
                </div>
                
                <div className="text-center p-2">
                    <p className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-widest flex items-center justify-center gap-2">
                        <Camera size={14}/> Align barcode within frame
                    </p>
                    <Button variant="secondary" onClick={() => { stopScanner().then(() => onClose()); }} className="w-full">Cancel Scanner</Button>
                </div>
            </div>
        </Modal>
    );
};

export default BarcodeScannerModal;
