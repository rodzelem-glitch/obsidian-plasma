export type ConfirmFn = (message: string, title?: string, confirmText?: string, cancelText?: string) => Promise<boolean>;

let confirmImpl: ConfirmFn = async (msg) => {
    console.warn("globalConfirm called before initialization! Fallback to false.");
    return false;
};

export const setGlobalConfirm = (fn: ConfirmFn) => {
    confirmImpl = fn;
};

export const globalConfirm: ConfirmFn = (msg, title, confirmText, cancelText) => {
    const isDemo = window.location.href.includes('isDemo=true') || document.body.dataset.demoMode === 'true';
    if (isDemo) {
        alert("Action blocked: The demo environment is locked for edits.");
        return Promise.resolve(false);
    }
    return confirmImpl(msg, title, confirmText, cancelText);
};
