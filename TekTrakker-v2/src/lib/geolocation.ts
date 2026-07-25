import { Geolocation } from '@capacitor/geolocation';

export interface LocationData {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
}

export const getCurrentLocation = async (): Promise<LocationData | null> => {
    try {
        const timeoutPromise = new Promise<null>((resolve) => {
            setTimeout(() => {
                console.warn("[getCurrentLocation] Timeout reached. Returning null.");
                resolve(null);
            }, 15000);
        });

        const getLocPromise = (async (): Promise<LocationData | null> => {
            try {
                const permissions = await Geolocation.checkPermissions();
                
                if (permissions.location !== 'granted') {
                    const request = await Geolocation.requestPermissions();
                    if (request.location !== 'granted') {
                        return null;
                    }
                }

                try {
                    // 1. Try high-accuracy native (10s timeout)
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
                } catch (highAccuracyErr) {
                    console.warn("Native high accuracy getCurrentPosition failed, attempting native low accuracy:", highAccuracyErr);
                    // 2. Try low-accuracy native (5s timeout)
                    try {
                        const position = await Geolocation.getCurrentPosition({
                            enableHighAccuracy: false,
                            timeout: 5000
                        });
                        return {
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                            accuracy: position.coords.accuracy,
                            timestamp: position.timestamp
                        };
                    } catch (lowAccuracyErr) {
                        console.warn("Native low accuracy getCurrentPosition failed too, falling back to browser:", lowAccuracyErr);
                        throw lowAccuracyErr;
                    }
                }
            } catch (e) {
                console.warn("Capacitor Geolocation Error, attempting browser fallback:", e);
                // Fallback to browser geolocation if not on native/failed
                return new Promise((resolve) => {
                    if (!navigator.geolocation) {
                        resolve(null);
                        return;
                    }
                    // 3. Try browser high accuracy
                    navigator.geolocation.getCurrentPosition(
                        (pos) => resolve({
                            latitude: pos.coords.latitude,
                            longitude: pos.coords.longitude,
                            accuracy: pos.coords.accuracy,
                            timestamp: pos.timestamp
                        }),
                        () => {
                            // 4. Try browser low accuracy
                            navigator.geolocation.getCurrentPosition(
                                (pos2) => resolve({
                                    latitude: pos2.coords.latitude,
                                    longitude: pos2.coords.longitude,
                                    accuracy: pos2.coords.accuracy,
                                    timestamp: pos2.timestamp
                                }),
                                () => resolve(null),
                                { enableHighAccuracy: false, timeout: 5000 }
                            );
                        },
                        { enableHighAccuracy: true, timeout: 5000 }
                    );
                });
            }
        })();

        return await Promise.race([getLocPromise, timeoutPromise]);
    } catch (globalErr) {
        console.error("Critical error in getCurrentLocation:", globalErr);
        return null;
    }
};
