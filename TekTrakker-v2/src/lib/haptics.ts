import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

export const triggerHapticFeedback = async (style: ImpactStyle = 'LIGHT' as any) => {
    try {
        if (Capacitor.isNativePlatform()) {
            await Haptics.impact({ style });
        }
    } catch (e) {
        // Ignore, haptics may not be supported
    }
};

export const triggerHapticSelectionStart = async () => {
    try {
        if (Capacitor.isNativePlatform()) {
            await Haptics.selectionStart();
        }
    } catch (e) { console.error(e); }
}

export const triggerHapticSelectionChanged = async () => {
    try {
        if (Capacitor.isNativePlatform()) {
            await Haptics.selectionChanged();
        }
    } catch (e) { console.error(e); }
}

export const triggerHapticSelectionEnd = async () => {
    try {
        if (Capacitor.isNativePlatform()) {
            await Haptics.selectionEnd();
        }
    } catch (e) { console.error(e); }
}
