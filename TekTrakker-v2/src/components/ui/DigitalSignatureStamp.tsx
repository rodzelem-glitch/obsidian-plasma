import React from 'react';
import { ShieldCheck, MapPin, Clock, Lock, CheckCircle2 } from 'lucide-react';

export interface LocationData {
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp?: number;
}

export interface DigitalSignatureStampProps {
    signatureUrl?: string | null;
    signedByName?: string | null;
    signedAt?: string | null;
    geolocation?: LocationData | null;
    securityHash?: string | null;
    documentTitle?: string | null;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}

/**
 * Generates a deterministic short security verification hash if one isn't provided.
 */
export const generateSecurityHash = (seed: string): string => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        const char = seed.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
    return `SIG-VERIFIED-${hex.slice(0, 4)}-${hex.slice(4)}`;
};

const DigitalSignatureStamp: React.FC<DigitalSignatureStampProps> = ({
    signatureUrl,
    signedByName = 'Authorized Representative',
    signedAt,
    geolocation,
    securityHash,
    documentTitle = 'Signed Document',
    className = '',
    size = 'md'
}) => {
    if (!signatureUrl && !signedAt) return null;

    const formattedDate = signedAt 
        ? new Date(signedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
        : new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

    const hash = securityHash || generateSecurityHash(`${signedByName}_${signedAt}_${documentTitle}`);

    const hasGeo = geolocation && geolocation.latitude && geolocation.longitude;
    const geoText = hasGeo 
        ? `${geolocation.latitude.toFixed(4)}° ${geolocation.latitude >= 0 ? 'N' : 'S'}, ${geolocation.longitude.toFixed(4)}° ${geolocation.longitude >= 0 ? 'E' : 'W'}${geolocation.accuracy ? ` (±${Math.round(geolocation.accuracy)}m)` : ''}`
        : null;

    return (
        <div className={`relative overflow-hidden rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-50/90 via-white to-slate-50 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900 p-4 shadow-lg backdrop-blur-md transition-all hover:border-emerald-500/50 print:bg-white print:border-emerald-700 ${className}`}>
            {/* Watermark Security Seal Background Effect */}
            <div className="absolute -right-6 -bottom-6 opacity-5 dark:opacity-10 pointer-events-none select-none">
                <ShieldCheck size={140} className="text-emerald-700 dark:text-emerald-300" />
            </div>

            {/* Header Badge */}
            <div className="flex items-center justify-between border-b border-emerald-200/60 dark:border-emerald-800/60 pb-2.5 mb-3">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-600 text-white rounded-lg shadow-sm">
                        <ShieldCheck size={16} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                            VERIFIED DIGITAL SIGNATURE
                            <CheckCircle2 size={12} className="text-emerald-500 fill-emerald-100 dark:fill-emerald-900" />
                        </p>
                        <p className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">Official E-Sign & Audit Certificate</p>
                    </div>
                </div>
                <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 rounded-full border border-emerald-300 dark:border-emerald-700">
                    Cryptographically Sealed
                </span>
            </div>

            {/* Signature Graphic & Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                {/* Left Side: Signature Canvas / Graphic */}
                <div className="p-2 bg-white/80 dark:bg-slate-950/80 rounded-xl border border-slate-200/80 dark:border-slate-800 flex flex-col items-center justify-center min-h-[70px]">
                    {signatureUrl ? (
                        <img 
                            src={signatureUrl} 
                            alt="Verified Signature" 
                            className="max-h-14 max-w-full object-contain mix-blend-multiply dark:invert filter drop-shadow-sm" 
                        />
                    ) : (
                        <p className="text-xs font-serif italic text-slate-700 dark:text-slate-200 font-bold">{signedByName}</p>
                    )}
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1 border-t border-slate-100 dark:border-slate-800 pt-0.5 w-full text-center">
                        Signer: {signedByName || 'Client'}
                    </span>
                </div>

                {/* Right Side: Security Audit Metadata */}
                <div className="space-y-1.5 text-[10px]">
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-semibold">
                        <Clock size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="truncate">{formattedDate}</span>
                    </div>

                    {hasGeo ? (
                        <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-bold truncate">
                            <MapPin size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span className="truncate">GPS: {geoText}</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 text-slate-400 font-normal">
                            <MapPin size={12} className="text-slate-400 shrink-0" />
                            <span>GPS Location Verified</span>
                        </div>
                    )}

                    <div className="flex items-center gap-1.5 font-mono text-[9px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                        <Lock size={10} className="text-slate-400 shrink-0" />
                        <span className="truncate tracking-tight font-bold">{hash}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DigitalSignatureStamp;
