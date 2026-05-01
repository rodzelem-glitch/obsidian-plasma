
import React from 'react';
import { triggerHapticFeedback } from '../../lib/haptics';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'solid'; // Expanded variants
    size?: 'sm' | 'md' | 'lg' | 'icon';
    isLoading?: boolean;
    as?: any; // Added for rendering as different elements (e.g., 'a')
    href?: string; // Added for link support
}

const Button: React.FC<ButtonProps> = ({ 
    variant = 'primary', 
    size = 'md', 
    isLoading, 
    className, 
    children, 
    as: Component = 'button',
    href,
    onClick,
    ...props 
}) => {
    
    const baseClass = "inline-flex items-center justify-center rounded-lg font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]";
    
    const sizeClasses = {
        sm: "px-3 py-1.5 text-xs min-h-[36px]",
        md: "px-4 py-2 text-sm min-h-[40px]",
        lg: "px-6 py-3 text-base min-h-[44px]",
        icon: "h-10 w-10 p-0 inline-flex items-center justify-center"
    };

    const variantClasses = {
        primary: "bg-primary-600 text-white hover:bg-primary-700 focus-visible:ring-primary-500 shadow-sm hover:shadow-md",
        secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 focus-visible:ring-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700",
        outline: "bg-transparent text-primary-600 border border-primary-500/50 hover:bg-primary-50 hover:border-primary-500 focus-visible:ring-primary-500 dark:text-primary-400 dark:border-primary-400/50 dark:hover:bg-primary-900/20",
        danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 shadow-sm",
        ghost: "bg-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700/60 border border-transparent",
        solid: "bg-primary-600 text-white hover:bg-primary-700 focus-visible:ring-primary-500 shadow-sm hover:shadow-md" // Map solid to primary
    };

    const handleClick = (e: any) => {
        if (!isLoading && !props.disabled) {
            triggerHapticFeedback();
        }
        if (onClick) {
            onClick(e);
        }
    };

    const combinedProps = {
        className: `${baseClass} ${sizeClasses[size]} ${variantClasses[variant] || variantClasses.primary} ${className || ''}`,
        disabled: isLoading || props.disabled,
        href,
        onClick: handleClick,
        ...props
    };
    
    return (
        <Component {...combinedProps}>
            {isLoading && (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            )}
            {children}
        </Component>
    );
};

export default Button;
