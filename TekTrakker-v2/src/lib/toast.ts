import { toast, ToastOptions, TypeOptions } from 'react-toastify';

/**
 * Global toast notification utility.
 * Use this instead of alert() throughout the platform.
 * 
 * Usage:
 *   import { showToast } from 'lib/toast';
 *   showToast.success("Job saved!");
 *   showToast.error("Upload failed.");
 *   showToast.info("Processing...");
 *   showToast.warn("File too large.");
 */

const defaultOptions: ToastOptions = {
    position: 'top-center',
    autoClose: 3000,
};

export const showToast = {
    success: (message: string, options?: ToastOptions) => {
        try {
            return toast.success(message, { ...defaultOptions, autoClose: 2500, ...options });
        } catch (e) {
            console.error('[Toast Error]', e);
        }
    },
    
    error: (message: string, options?: ToastOptions) => {
        try {
            return toast.error(message, { ...defaultOptions, autoClose: 4000, ...options });
        } catch (e) {
            console.error('[Toast Error]', e);
        }
    },
    
    info: (message: string, options?: ToastOptions) => {
        try {
            return toast.info(message, { ...defaultOptions, ...options });
        } catch (e) {
            console.error('[Toast Error]', e);
        }
    },
    
    warn: (message: string, options?: ToastOptions) => {
        try {
            return toast.warn(message, { ...defaultOptions, autoClose: 4000, ...options });
        } catch (e) {
            console.error('[Toast Error]', e);
        }
    },
};

export default showToast;

