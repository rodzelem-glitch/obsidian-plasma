import React from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'; 
    zIndex?: string;
    closeOnBackdropClick?: boolean;
    closeOnEscape?: boolean;
}

const Modal: React.FC<ModalProps> = ({ 
    isOpen, 
    onClose, 
    title, 
    children, 
    size = 'lg', 
    zIndex,
    closeOnBackdropClick = false,
    closeOnEscape = false
}) => {
    const [isShaking, setIsShaking] = React.useState(false);
    const shakeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    React.useEffect(() => {
        return () => {
            if (shakeTimeoutRef.current) {
                clearTimeout(shakeTimeoutRef.current);
            }
        };
    }, []);

    if (!isOpen) return null;

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target !== e.currentTarget) return;
        if (closeOnBackdropClick) {
            onClose();
        } else {
            setIsShaking(true);
            if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);
            shakeTimeoutRef.current = setTimeout(() => {
                setIsShaking(false);
            }, 300);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Escape' && closeOnEscape) {
            onClose();
        }
    };

    const sizeClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-4xl',
        full: 'max-w-full h-full' 
    };

    const zIndexClass = zIndex || (size === 'full' ? 'z-[200]' : 'z-[250]');

    return ReactDOM.createPortal(
        <div 
            className={`fixed inset-0 flex items-center justify-center p-2 md:p-4 bg-black/60 backdrop-blur-sm animate-fade-in ${zIndexClass} pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]`}
            onClick={handleBackdropClick}
            onKeyDown={handleKeyDown}
        >
            <div className={`animate-modal-in bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 rounded-2xl shadow-2xl w-full ${sizeClasses[size]} overflow-hidden flex flex-col max-h-full ${size === 'full' ? 'h-full' : 'max-h-[90vh]'} border border-slate-200/50 dark:border-slate-700/50 transition-all duration-150 ease-out ${isShaking ? 'scale-[1.015] ring-4 ring-primary-500/40 shadow-primary-500/20' : ''}`}>
                <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 sticky top-0 z-10 shrink-0">
                    <h3 className="text-base md:text-lg font-bold text-slate-900 dark:text-white tracking-tight">{title}</h3>
                    <button 
                        onClick={onClose} 
                        className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors"
                        aria-label="Close"
                        title="Close"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="p-4 md:p-6 overflow-y-auto flex-1 custom-scrollbar relative z-0 relative isolate">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default Modal;
