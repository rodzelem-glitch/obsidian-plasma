import React, { useEffect, useRef, useCallback, useImperativeHandle } from 'react';

export interface AutoResizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    minHeight?: number;
    maxHeight?: number;
}

export const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(({
    value,
    defaultValue,
    onChange,
    onInput,
    className = '',
    style,
    rows = 1,
    minHeight,
    maxHeight,
    ...props
}, ref) => {
    const internalRef = useRef<HTMLTextAreaElement | null>(null);

    useImperativeHandle(ref, () => internalRef.current as HTMLTextAreaElement);

    const adjustHeight = useCallback(() => {
        const textarea = internalRef.current;
        if (!textarea) return;

        // Reset height to auto to compute accurate scrollHeight
        textarea.style.height = 'auto';
        
        let newHeight = textarea.scrollHeight;
        if (minHeight && newHeight < minHeight) {
            newHeight = minHeight;
        }
        if (maxHeight && newHeight > maxHeight) {
            newHeight = maxHeight;
            textarea.style.overflowY = 'auto';
        } else {
            textarea.style.overflowY = 'hidden';
        }

        textarea.style.height = `${newHeight}px`;
    }, [minHeight, maxHeight]);

    // Adjust immediately on mount and whenever value or defaultValue changes
    useEffect(() => {
        adjustHeight();
    }, [value, defaultValue, adjustHeight]);

    // Recalculate on window resize to handle wrapped text recalculation
    useEffect(() => {
        window.addEventListener('resize', adjustHeight);
        return () => window.removeEventListener('resize', adjustHeight);
    }, [adjustHeight]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        adjustHeight();
        onChange?.(e);
    };

    const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
        adjustHeight();
        onInput?.(e);
    };

    return (
        <textarea
            ref={internalRef}
            rows={rows}
            value={value}
            defaultValue={defaultValue}
            onChange={handleChange}
            onInput={handleInput}
            className={`resize-none overflow-hidden transition-[height] duration-75 ${className}`}
            style={{
                ...style,
                minHeight: minHeight ? `${minHeight}px` : undefined,
                maxHeight: maxHeight ? `${maxHeight}px` : undefined,
            }}
            {...props}
        />
    );
});

AutoResizeTextarea.displayName = 'AutoResizeTextarea';

export default AutoResizeTextarea;
