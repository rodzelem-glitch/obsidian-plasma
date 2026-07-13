import { toast } from "react-toastify"; import type { ToastOptions, TypeOptions } from 'react-toastify';

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
    success: (message: string, options?: ToastOptions) => 
        toast.success(message, { ...defaultOptions, autoClose: 2500, ...options }),
    
    error: (message: string, options?: ToastOptions) => 
        toast.error(message, { ...defaultOptions, autoClose: 4000, ...options }),
    
    info: (message: string, options?: ToastOptions) => 
        toast.info(message, { ...defaultOptions, ...options }),
    
    warn: (message: string, options?: ToastOptions) => 
        toast.warn(message, { ...defaultOptions, autoClose: 4000, ...options }),
};

export default showToast;
