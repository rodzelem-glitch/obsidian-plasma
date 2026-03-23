
import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

const Card: React.FC<CardProps> = ({ className, children, ...props }) => {
    return (
        <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-3 md:p-4 ${className || ''}`} {...props}>
            {children}
        </div>
    );
};

export default Card;
