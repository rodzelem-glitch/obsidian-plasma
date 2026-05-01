import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { setGlobalConfirm } from 'lib/globalConfirm';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';

interface ConfirmContextType {
    confirm: (message: string, title?: string) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const useConfirm = () => {
    const context = useContext(ConfirmContext);
    if (!context) throw new Error("useConfirm must be used within ConfirmProvider");
    return context;
};

export const ConfirmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [title, setTitle] = useState('Confirm Action');
    const [confirmText, setConfirmText] = useState('Confirm');
    const [cancelText, setCancelText] = useState('Cancel');
    const resolverRef = React.useRef<(value: boolean) => void>();

    const confirm = useCallback((msg: string, titleStr: string = 'Confirm Action', cText: string = 'Confirm', xText: string = 'Cancel'): Promise<boolean> => {
        setMessage(msg);
        setTitle(titleStr);
        setConfirmText(cText);
        setCancelText(xText);
        setIsOpen(true);
        return new Promise((resolve) => {
            resolverRef.current = resolve;
        });
    }, []);

    useEffect(() => {
        setGlobalConfirm(confirm);
    }, [confirm]);

    const handleConfirm = () => {
        setIsOpen(false);
        if (resolverRef.current) resolverRef.current(true);
    };

    const handleCancel = () => {
        setIsOpen(false);
        if (resolverRef.current) resolverRef.current(false);
    };

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            <Modal isOpen={isOpen} onClose={handleCancel} title={title}>
                <div className="p-4 pt-1">
                    <p className="text-gray-700 dark:text-gray-300 mb-6 whitespace-pre-wrap">{message}</p>
                    <div className="flex justify-end gap-3">
                        <Button className="bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 border-0" onClick={handleCancel}>{cancelText}</Button>
                        <Button className="bg-red-600 hover:bg-red-700 text-white border-0" onClick={handleConfirm}>{confirmText}</Button>
                    </div>
                </div>
            </Modal>
        </ConfirmContext.Provider>
    );
};
