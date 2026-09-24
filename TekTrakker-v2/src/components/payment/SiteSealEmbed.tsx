import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { ShieldCheck, ExternalLink } from 'lucide-react';

interface SiteSealEmbedProps {
    sealHtml?: string | null;
    className?: string;
    showLabel?: boolean;
    align?: 'center' | 'left' | 'right';
}

export const SiteSealEmbed: React.FC<SiteSealEmbedProps> = ({
    sealHtml,
    className = '',
    showLabel = true,
    align = 'center'
}) => {
    const sealData = useMemo(() => {
        if (!sealHtml || typeof sealHtml !== 'string') return null;
        const trimmed = sealHtml.trim();
        if (!trimmed) return null;

        // Check if this is a RapidScanSecure / CompliAssure seal
        const rapidScanCodeMatch = trimmed.match(/rapidscansecure\.com.*?code=([a-zA-Z0-9,._-]+)/i) || 
                                   trimmed.match(/code=([0-9]+,[a-zA-Z0-9]+)/i);

        if (rapidScanCodeMatch && rapidScanCodeMatch[1]) {
            const rawCode = rapidScanCodeMatch[1].replace(/['"]/g, '');
            return {
                type: 'rapidscan' as const,
                code: rawCode,
                sealImgUrl: `https://rapidscansecure.com/siteseal/Seal.aspx?code=${rawCode}`,
                verifyUrl: `https://rapidscansecure.com/siteseal/Verify.aspx?code=${rawCode}`
            };
        }

        // Generic image or HTML snippet
        const imgMatch = trimmed.match(/<img[^>]+src=['"]([^'"]+)['"][^>]*>/i);
        const linkMatch = trimmed.match(/<a[^>]+href=['"]([^'"]+)['"][^>]*>/i);

        if (imgMatch) {
            return {
                type: 'generic_img' as const,
                imgSrc: imgMatch[1],
                linkHref: linkMatch ? linkMatch[1] : undefined
            };
        }

        return {
            type: 'raw' as const,
            html: trimmed
        };
    }, [sealHtml]);

    if (!sealData) return null;

    const handleRapidScanClick = (e: React.MouseEvent) => {
        e.preventDefault();
        if (sealData.type !== 'rapidscan') return;

        const width = 960;
        const height = 540;
        const left = Math.max(0, Math.round((window.screen.width - width) / 2));
        const top = Math.max(0, Math.round((window.screen.height - height) / 2));

        window.open(
            sealData.verifyUrl,
            'Verification',
            `location=no,toolbar=no,resizable=yes,scrollbars=yes,directories=no,status=no,width=${width},height=${height},top=${top},left=${left}`
        );
    };

    return (
        <div className={`site-seal-wrapper inline-flex flex-col items-${align === 'center' ? 'center' : align === 'right' ? 'end' : 'start'} ${className}`}>
            {sealData.type === 'rapidscan' ? (
                <div className="flex flex-col items-center gap-1">
                    <a
                        href={sealData.verifyUrl}
                        onClick={handleRapidScanClick}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="PCI DSS Compliant Merchant • Click to verify certificate"
                        className="group inline-flex items-center gap-2 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 shadow-sm hover:shadow-md hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition-all duration-200 cursor-pointer text-decoration-none focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    >
                        <img
                            src={sealData.sealImgUrl}
                            alt="PCI DSS Compliant Merchant SiteSeal"
                            className="h-10 sm:h-12 w-auto object-contain transition-transform group-hover:scale-105"
                            onError={(e) => {
                                const target = e.currentTarget;
                                target.style.display = 'none';
                                if (target.nextElementSibling) {
                                    target.nextElementSibling.setAttribute('style', 'display: flex;');
                                }
                            }}
                        />
                        <div style={{ display: 'none' }} className="items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                            <ShieldCheck size={16} className="text-emerald-500" />
                            <span>PCI DSS Validated</span>
                            <ExternalLink size={12} className="opacity-60" />
                        </div>
                    </a>
                    {showLabel && (
                        <span className="text-[9px] uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                            <ShieldCheck size={11} className="text-emerald-500" />
                            PCI DSS SAQ-A Validated
                        </span>
                    )}
                </div>
            ) : sealData.type === 'generic_img' ? (
                <div className="flex flex-col items-center gap-1">
                    {sealData.linkHref ? (
                        <a href={sealData.linkHref} target="_blank" rel="noopener noreferrer" className="inline-block">
                            <img src={sealData.imgSrc} alt="Security Compliance Seal" className="h-10 sm:h-12 w-auto object-contain" />
                        </a>
                    ) : (
                        <img src={sealData.imgSrc} alt="Security Compliance Seal" className="h-10 sm:h-12 w-auto object-contain" />
                    )}
                    {showLabel && (
                        <span className="text-[9px] uppercase tracking-widest font-black text-slate-400 dark:text-slate-500">
                            Verified Security Seal
                        </span>
                    )}
                </div>
            ) : (
                <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(sealData.html || '') }} />
            )}
        </div>
    );
};

export default SiteSealEmbed;
