import React from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string | React.ReactNode;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'; 
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
            // Provide subtle visual feedback that the modal is locked open to protect unsaved work
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
        sm: 'max-w-sm w-full mx-2 sm:mx-auto',
        md: 'max-w-md w-full mx-2 sm:mx-auto',
        lg: 'max-w-3xl lg:max-w-4xl w-full mx-2 sm:mx-auto',
        xl: 'max-w-5xl lg:max-w-6xl w-full mx-2 sm:mx-auto',
        '2xl': 'max-w-7xl w-full mx-2 sm:mx-auto',
        full: 'max-w-full h-full' 
    };

    const zIndexClass = zIndex || 'z-[10050]';

    return ReactDOM.createPortal(
        <div 
            role="presentation"
            className={`fixed inset-0 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in ${zIndexClass} pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]`}
            onClick={handleBackdropClick}
            onKeyDown={handleKeyDown}
        >
            <div className={`animate-modal-in bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 rounded-2xl shadow-2xl w-full ${sizeClasses[size]} overflow-hidden flex flex-col ${size === 'full' ? 'h-full' : (size === 'xl' || size === '2xl') ? 'max-h-[92dvh] sm:max-h-[96dvh] h-[92dvh] sm:h-[96dvh]' : 'max-h-[90dvh]'} border border-slate-200/50 dark:border-slate-700/50 transition-all duration-150 ease-out ${isShaking ? 'scale-[1.015] ring-4 ring-primary-500/40 shadow-primary-500/20' : ''}`}>
                <div className="flex justify-between items-center gap-3 p-3 sm:p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 sticky top-0 z-10 shrink-0">
                    <div className="min-w-0 flex-1">
                        <h3 className="text-base md:text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate">{title}</h3>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors shrink-0 touch-manipulation cursor-pointer"
                        aria-label="Close"
                        title="Close"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="p-3 sm:p-6 overflow-y-auto flex-1 custom-scrollbar relative z-0 isolate overscroll-y-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default Modal;
