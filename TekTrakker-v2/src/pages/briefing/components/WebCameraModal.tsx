import React, { useEffect, useRef, useState } from 'react';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { Camera, XCircle, RefreshCw, Zap, ZapOff, Navigation, CheckCircle } from 'lucide-react';

export interface GeoLocationData {
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp: string;
}

interface WebCameraModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCapture: (dataUrl: string, locationData?: GeoLocationData) => void;
}

export type FlashMode = 'off' | 'on' | 'auto';

const WebCameraModal: React.FC<WebCameraModalProps> = ({ isOpen, onClose, onCapture }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isMirror, setIsMirror] = useState(false);
    const [flashMode, setFlashMode] = useState<FlashMode>('off');
    const [isFlashing, setIsFlashing] = useState(false);
    const [isCaptured, setIsCaptured] = useState(false);
    const [capturedCount, setCapturedCount] = useState(0);

    // Geolocation states
    const [location, setLocation] = useState<GeoLocationData | null>(null);
    const [locationStatus, setLocationStatus] = useState<'fetching' | 'ready' | 'error'>('fetching');

    const applyTorch = async (mediaStream: MediaStream | null, mode: FlashMode) => {
        if (!mediaStream) return;
        const track = mediaStream.getVideoTracks()[0];
        if (track && typeof (track as any).getCapabilities === 'function') {
            try {
                const capabilities = (track as any).getCapabilities() || {};
                if (capabilities.torch) {
                    await track.applyConstraints({
                        advanced: [{ torch: mode === 'on' }]
                    } as any);
                }
            } catch (e) {
                console.warn("Hardware torch application note:", e);
            }
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => {
                try {
                    if (typeof (track as any).getCapabilities === 'function') {
                        const caps = (track as any).getCapabilities() || {};
                        if (caps.torch) {
                            track.applyConstraints({ advanced: [{ torch: false }] } as any).catch(() => {});
                        }
                    }
                } catch (e) {}
                track.stop();
            });
            setStream(null);
        }
    };

    useEffect(() => {
        if (isOpen) {
            setIsCaptured(false);
            setIsFlashing(false);
            setCapturedCount(0);
            setLocationStatus('fetching');

            // 1. Start Geolocation capture
            let watchId: number | null = null;
            if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        setLocation({
                            latitude: pos.coords.latitude,
                            longitude: pos.coords.longitude,
                            accuracy: Math.round(pos.coords.accuracy),
                            timestamp: new Date().toISOString()
                        });
                        setLocationStatus('ready');
                    },
                    (err) => {
                        console.warn("Geolocation position error:", err);
                        setLocationStatus('error');
                    },
                    { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
                );

                watchId = navigator.geolocation.watchPosition(
                    (pos) => {
                        setLocation({
                            latitude: pos.coords.latitude,
                            longitude: pos.coords.longitude,
                            accuracy: Math.round(pos.coords.accuracy),
                            timestamp: new Date().toISOString()
                        });
                        setLocationStatus('ready');
                    },
                    (err) => {
                        console.warn("Geolocation watch error:", err);
                    },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
                );
            } else {
                setLocationStatus('error');
            }

            // 2. Start Camera stream
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
                    if (flashMode === 'on') {
                        await applyTorch(mediaStream, 'on');
                    }
                } catch (err: any) {
                    console.error("Camera access error:", err);
                    setError("Could not access camera. Please check permissions.");
                }
            };

            startCamera();

            return () => {
                stopCamera();
                if (watchId !== null && 'geolocation' in navigator) {
                    navigator.geolocation.clearWatch(watchId);
                }
            };
        }
    }, [isOpen]);

    const toggleFlashMode = async () => {
        const nextMode: FlashMode = flashMode === 'off' ? 'on' : flashMode === 'on' ? 'auto' : 'off';
        setFlashMode(nextMode);
        if (stream) {
            await applyTorch(stream, nextMode);
        }
    };

    const capturePhoto = () => {
        if (isCaptured) return;
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            if (!context) return;

            const executeCapture = () => {
                setIsCaptured(true);
                const w = video.videoWidth || 1280;
                const h = video.videoHeight || 720;
                canvas.width = w;
                canvas.height = h;
                
                if (isMirror) {
                    context.translate(w, 0);
                    context.scale(-1, 1);
                }
                
                // Draw base video frame
                context.drawImage(video, 0, 0, w, h);

                // Reset canvas transformations for overlay drawing
                if (isMirror) {
                    context.setTransform(1, 0, 0, 1, 0, 0);
                }

                // Draw Watermark Overlay Banner at the bottom
                const bannerHeight = Math.max(50, Math.round(h * 0.09));
                const bannerY = h - bannerHeight;

                // Dark background banner
                context.fillStyle = 'rgba(15, 23, 42, 0.85)';
                context.fillRect(0, bannerY, w, bannerHeight);

                // Accent top border line (Cyan/Sky)
                context.fillStyle = '#0ea5e9';
                context.fillRect(0, bannerY, w, Math.max(2, Math.round(h * 0.004)));

                // Watermark Text styling
                const fontSizeMain = Math.max(12, Math.round(bannerHeight * 0.28));
                const fontSizeSub = Math.max(10, Math.round(bannerHeight * 0.22));

                context.fillStyle = '#ffffff';
                context.font = `bold ${fontSizeMain}px sans-serif`;
                context.textAlign = 'left';

                const padX = Math.round(w * 0.025);
                const line1Y = bannerY + (bannerHeight * 0.42);
                const line2Y = bannerY + (bannerHeight * 0.78);

                const now = new Date();
                const timeStr = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

                if (location) {
                    const latStr = `${Math.abs(location.latitude).toFixed(5)}° ${location.latitude >= 0 ? 'N' : 'S'}`;
                    const lngStr = `${Math.abs(location.longitude).toFixed(5)}° ${location.longitude >= 0 ? 'E' : 'W'}`;
                    const accStr = location.accuracy ? ` (±${location.accuracy}m)` : '';

                    // Main Line: GPS Coordinates
                    context.fillStyle = '#38bdf8'; // Sky blue
                    context.fillText(`📍 GPS: ${latStr}, ${lngStr}${accStr}`, padX, line1Y);

                    // Sub Line: Date/Time & Verification Badge
                    context.fillStyle = '#94a3b8'; // Slate
                    context.font = `${fontSizeSub}px sans-serif`;
                    context.fillText(`📅 ${timeStr}  •  TEKTRAKKER VERIFIED FIELD PHOTO`, padX, line2Y);
                } else {
                    context.fillStyle = '#f59e0b'; // Amber fallback
                    context.fillText(`📍 TEKTRAKKER FIELD PHOTO`, padX, line1Y);

                    context.fillStyle = '#94a3b8';
                    context.font = `${fontSizeSub}px sans-serif`;
                    context.fillText(`📅 ${timeStr}`, padX, line2Y);
                }

                const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
                
                setIsFlashing(false);
                onCapture(dataUrl, location || undefined);
                setCapturedCount(prev => prev + 1);
                // Brief 350ms cooldown to acknowledge photo capture, then re-enable continuous snapping
                setTimeout(() => {
                    setIsCaptured(false);
                }, 350);
            };

            if (flashMode === 'on' || flashMode === 'auto') {
                setIsFlashing(true);
                setTimeout(() => {
                    executeCapture();
                }, 180);
            } else {
                executeCapture();
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
                    
                    {/* Screen Flash Fill-Light Overlay */}
                    {isFlashing && (
                        <div className="absolute inset-0 bg-white z-50 animate-pulse transition-opacity duration-150" />
                    )}

                    {/* Active Flash Indicator Badge */}
                    {flashMode !== 'off' && (
                        <div className="absolute top-3 left-3 z-30 bg-amber-400 text-slate-950 font-black text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-lg tracking-wider uppercase">
                            <Zap size={13} className="fill-slate-950" />
                            <span>FLASH: {flashMode}</span>
                        </div>
                    )}

                    {/* Captured Count Live Badge */}
                    {capturedCount > 0 && (
                        <div className="absolute bottom-3 left-3 z-30 bg-emerald-600 text-white font-black text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg tracking-wider uppercase animate-bounce">
                            <CheckCircle size={14} />
                            <span>{capturedCount} {capturedCount === 1 ? 'Photo' : 'Photos'} Snapped</span>
                        </div>
                    )}

                    {/* Geolocation Live Badge */}
                    <div className={`absolute top-3 right-3 z-30 font-bold text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-lg tracking-wider uppercase backdrop-blur-md transition-all ${
                        locationStatus === 'ready' 
                            ? 'bg-emerald-500/90 text-white border border-emerald-400/50' 
                            : locationStatus === 'fetching' 
                            ? 'bg-amber-500/90 text-white animate-pulse border border-amber-400/50'
                            : 'bg-slate-800/80 text-slate-300 border border-slate-700'
                    }`}>
                        <Navigation size={12} className={locationStatus === 'fetching' ? 'animate-spin' : ''} />
                        <span>
                            {locationStatus === 'ready' && location 
                                ? `GPS VERIFIED (${location.latitude.toFixed(4)}°, ${location.longitude.toFixed(4)}°)` 
                                : locationStatus === 'fetching' 
                                ? 'LOCATING GPS...' 
                                : 'GPS UNKNOWN'}
                        </span>
                    </div>

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
                            <Button onClick={() => window.location.href = window.location.pathname + window.location.search} className="bg-primary-600 px-8 py-3 rounded-full shadow-lg hover:shadow-primary-500/50 transition-all">Retry Permissions</Button>
                        </div>
                    )}
                </div>
                
                <div className="flex flex-col gap-3 p-2">
                    <Button 
                        onClick={capturePhoto} 
                        disabled={!stream || isCaptured}
                        className="w-full h-14 bg-primary-600 hover:bg-primary-700 text-white font-black text-lg rounded-2xl flex items-center justify-center gap-3 shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                            <Camera size={24}/>
                        </div>
                        {capturedCount > 0 ? `SNAP ANOTHER PHOTO (${capturedCount} Taken)` : 'TAKE GPS VERIFIED PHOTO'}
                    </Button>
                    
                    <div className="flex gap-2 items-center">
                        <Button 
                            variant="secondary" 
                            onClick={toggleFlashMode}
                            className={`flex-1 h-10 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 rounded-xl border transition-all ${
                                flashMode !== 'off'
                                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border-amber-400 shadow-sm'
                                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                            }`}
                        >
                            {flashMode !== 'off' ? (
                                <Zap size={15} className="text-amber-500 fill-amber-500" />
                            ) : (
                                <ZapOff size={15} className="text-slate-400" />
                            )}
                            Flash: {flashMode.toUpperCase()}
                        </Button>

                        <Button 
                            variant="secondary" 
                            onClick={() => setIsMirror(!isMirror)}
                            className="flex-1 h-10 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 rounded-xl"
                        >
                            <RefreshCw size={14} className={isMirror ? 'rotate-180 transition-transform' : 'transition-transform'}/> Mirror Mode
                        </Button>
                        
                        {capturedCount > 0 ? (
                            <Button 
                                onClick={onClose} 
                                className="h-10 text-xs font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white px-4 rounded-xl flex items-center gap-1.5 shadow-sm shrink-0"
                            >
                                <CheckCircle size={14} /> Done ({capturedCount})
                            </Button>
                        ) : (
                            <Button 
                                variant="ghost" 
                                onClick={onClose} 
                                className="h-10 text-xs font-bold uppercase tracking-wider text-slate-500 px-3"
                            >
                                Cancel
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default WebCameraModal;
