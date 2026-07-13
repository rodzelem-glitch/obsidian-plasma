export type ConfirmFn = (message: string, title?: string, confirmText?: string, cancelText?: string) => Promise<boolean>;

let confirmImpl: ConfirmFn = async (msg) => {
    console.warn("globalConfirm called before initialization! Fallback to false.");
    return false;
};

export const setGlobalConfirm = (fn: ConfirmFn) => {
    confirmImpl = fn;
};

export const globalConfirm: ConfirmFn = (msg, title, confirmText, cancelText) => confirmImpl(msg, title, confirmText, cancelText);
