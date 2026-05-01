import { Geolocation } from '@capacitor/geolocation';

export interface LocationData {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
}

export const getCurrentLocation = async (): Promise<LocationData | null> => {
    try {
        const permissions = await Geolocation.checkPermissions();
        
        if (permissions.location !== 'granted') {
            const request = await Geolocation.requestPermissions();
            if (request.location !== 'granted') {
                return null;
            }
        }

        const position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 10000
        });

        return {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
        };
    } catch (e) {
        console.error("Geolocation Error:", e);
        // Fallback to browser geolocation if not on native/failed
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve(null);
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                    timestamp: pos.timestamp
                }),
                () => resolve(null),
                { enableHighAccuracy: true, timeout: 10000 }
            );
        });
    }
};
