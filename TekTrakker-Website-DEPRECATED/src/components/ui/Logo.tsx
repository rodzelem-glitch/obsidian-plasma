import React from 'react';

// IMPORTANT: Ensure the uploaded image files are saved in your 'public' folder with these names:
const HORIZONTAL_LOGO_PATH = "tektrakker-logo-web.webp";
const SQUARE_LOGO_PATH = "tektrakker-icon.webp";

export const Logo: React.FC<{ className?: string }> = ({ className }) => {
    return (
        <img 
            src={HORIZONTAL_LOGO_PATH} 
            alt="TekTrakker" 
            width={300}
            height={108}
            className={`max-w-full max-h-full object-contain ${className || 'h-auto'}`}
            onError={(e) => {
                // Fallback if image isn't found
                (e.currentTarget as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>';
            }}
        />
    );
};

export const LogoIcon: React.FC<{ className?: string }> = ({ className }) => {
    return (
        <img 
            src={SQUARE_LOGO_PATH} 
            alt="TekTrakker Icon" 
            width={1088}
            height={960}
            className={`max-w-full max-h-full object-contain ${className || 'h-auto'}`}
            onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>';
            }}
        />
    );
};

