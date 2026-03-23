
import React, { useEffect, useRef, useState } from 'react';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { Camera, XCircle, RefreshCw } from 'lucide-react';

interface WebCameraModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCapture: (dataUrl: string) => void;
}

const WebCameraModal: React.FC<WebCameraModalProps> = ({ isOpen, onClose, onCapture }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isMirror, setIsMirror] = useState(false);

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    useEffect(() => {
        if (isOpen) {
            const startCamera = async () => {
                setError(null);
                try {
                    const mediaStream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
                        audio: false
                    });
                    setStream(mediaStream);
                    if (videoRef.current) {
                        videoRef.current.srcObject = mediaStream;
                    }
                } catch (err: any) {
                    console.error("Camera access error:", err);
                    setError("Could not access camera. Please check permissions.");
                }
            };

            startCamera();
            return () => stopCamera();
        }
    }, [isOpen]);

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            if (context) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                
                if (isMirror) {
                    context.translate(canvas.width, 0);
                    context.scale(-1, 1);
                }
                
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                onCapture(dataUrl);
                onClose();
            }
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Capture Photo">
            <div className="space-y-4">
                <div className="relative w-full aspect-square md:aspect-video bg-black rounded-xl overflow-hidden shadow-2xl flex items-center justify-center border-4 border-slate-200 dark:border-slate-800">
                    <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        muted 
                        className={`w-full h-full object-cover ${isMirror ? 'scale-x-[-1]' : ''}`}
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    
                    {!stream && !error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-slate-900/80 backdrop-blur-sm">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500 mb-4"></div>
                            <p className="text-sm font-bold uppercase tracking-widest text-slate-300">Activating Camera...</p>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-slate-900/90 backdrop-blur-md">
                            <XCircle className="text-red-500 mb-4 animate-pulse" size={56} />
                            <p className="text-white font-bold mb-6 text-lg">{error}</p>
                            <Button onClick={() => window.location.reload()} className="bg-primary-600 px-8 py-3 rounded-full shadow-lg hover:shadow-primary-500/50 transition-all">Retry Permissions</Button>
                        </div>
                    )}
                </div>
                
                <div className="flex flex-col gap-3 p-2">
                    <Button 
                        onClick={capturePhoto} 
                        disabled={!stream}
                        className="w-full h-14 bg-primary-600 hover:bg-primary-700 text-white font-black text-lg rounded-2xl flex items-center justify-center gap-3 shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                            <Camera size={24}/>
                        </div>
                        TAKE PHOTO
                    </Button>
                    
                    <div className="flex gap-2">
                        <Button 
                            variant="secondary" 
                            onClick={() => setIsMirror(!isMirror)}
                            className="flex-1 h-10 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 rounded-xl"
                        >
                            <RefreshCw size={14} className={isMirror ? 'rotate-180 transition-transform' : 'transition-transform'}/> Mirror Mode
                        </Button>
                        <Button 
                            variant="ghost" 
                            onClick={onClose} 
                            className="flex-1 h-10 text-xs font-bold uppercase tracking-wider text-slate-500"
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default WebCameraModal;
