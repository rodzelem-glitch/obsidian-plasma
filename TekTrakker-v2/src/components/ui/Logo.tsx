import React from 'react';
import { useFranchise } from '../../context/FranchiseContext';

// IMPORTANT: Ensure the uploaded image files are saved in your 'public' folder with these names:
const HORIZONTAL_LOGO_PATH = "tektrakker-logo-web.png";
const SQUARE_LOGO_PATH = "tektrakker-icon.png";

export const Logo: React.FC<{ className?: string }> = ({ className }) => {
    const { activeFranchise } = useFranchise();
    return (
        <img 
            src={activeFranchise?.branding?.logoUrl || HORIZONTAL_LOGO_PATH} 
            alt={activeFranchise?.branding?.appName || "TekTrakker"} 
            className={`max-w-full max-h-full object-contain ${className || 'h-auto'}`}
            onError={(e) => {
                // Fallback if image isn't found
                (e.currentTarget as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>';
            }}
        />
    );
};

export const LogoIcon: React.FC<{ className?: string }> = ({ className }) => {
    const { activeFranchise } = useFranchise();
    return (
        <img 
            src={activeFranchise?.branding?.logoUrl || SQUARE_LOGO_PATH} 
            alt={activeFranchise?.branding?.appName ? `${activeFranchise.branding.appName} Icon` : "TekTrakker Icon"} 
            className={`max-w-full max-h-full object-contain ${className || 'h-auto'}`}
            onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>';
            }}
        />
    );
};

