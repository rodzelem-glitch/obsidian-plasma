
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


export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
    <div className={`flex flex-col space-y-1.5 ${className || ''}`} {...props} />
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, ...props }) => (
    <h3 className={`font-semibold leading-none tracking-tight ${className || ''}`} {...props} />
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
    <div className={`pt-0 ${className || ''}`} {...props} />
);
