
import React from 'react';

// IMPORTANT: Ensure the uploaded image files are saved in your 'public' folder with these names:
const HORIZONTAL_LOGO_PATH = "/tektrakker-logo-full.png";
const SQUARE_LOGO_PATH = "/tektrakker-icon.png";

export const Logo: React.FC<{ className?: string }> = ({ className }) => (
    <img 
        src={HORIZONTAL_LOGO_PATH} 
        alt="TekTrakker" 
        className={`object-contain ${className}`}
        onError={(e) => {
            // Fallback if image isn't found yet
            e.currentTarget.style.display = 'none';
            const span = document.createElement('span');
            span.innerText = 'TekTrakker';
            span.className = 'font-black text-xl text-primary-600';
            e.currentTarget.parentNode?.appendChild(span);
        }}
    />
);

export const LogoIcon: React.FC<{ className?: string }> = ({ className }) => (
    <img 
        src={SQUARE_LOGO_PATH} 
        alt="TekTrakker Icon" 
        className={`object-contain ${className}`}
        onError={(e) => {
            e.currentTarget.style.display = 'none';
        }}
    />
);
