
import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    interactive?: boolean;
}

const Card: React.FC<CardProps> = ({ className, children, interactive, ...props }) => {
    return (
        <div 
            className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm p-3 md:p-4 transition-all duration-200 ${interactive ? 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer active:scale-[0.99]' : ''} ${className || ''}`} 
            {...props}
        >
            {children}
        </div>
    );
};

export default Card;
