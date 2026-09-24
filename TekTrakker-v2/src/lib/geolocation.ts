import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export interface LocationData {
    latitude: number;
    longitude: number;
    lat: number;
    lng: number;
    accuracy?: number;
    timestamp?: number;
}

export interface LocationOptions {
    enableHighAccuracy?: boolean;
    timeout?: number;
    maximumAge?: number;
}

/**
 * Robust cross-platform helper to retrieve the device's current GPS location.
 * - Handles Native Android (including Android 12+ coarse vs fine location).
 * - Handles Native iOS.
 * - Handles Web/Desktop/PWA without throwing unimplemented Capacitor errors.
 * - Tries high accuracy first, seamlessly falls back to lower accuracy / cached fix if GPS lock is slow or indoors.
 */
export const getCurrentLocation = async (options?: LocationOptions): Promise<LocationData | null> => {
    const isNative = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
    const timeoutMs = options?.timeout ?? 25000;
    const maxAge = options?.maximumAge ?? 300000; // 5 minutes cache fallback for indoor/roof units

    // Master timeout promise to guarantee resolution
    const masterTimeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => {
            console.warn("[getCurrentLocation] Master timeout reached. Returning null.");
            resolve(null);
        }, timeoutMs);
    });

    const getLocPromise = (async (): Promise<LocationData | null> => {
        // 1. Native platform (Android / iOS)
        if (isNative) {
            try {
                let permissions = await Geolocation.checkPermissions();
                const hasPermission = permissions.location === 'granted' || permissions.coarseLocation === 'granted';

                if (!hasPermission) {
                    const request = await Geolocation.requestPermissions();
                    const hasGranted = request.location === 'granted' || request.coarseLocation === 'granted';
                    if (!hasGranted) {
                        console.warn("[getCurrentLocation] Native location permission denied by user.");
                        return null;
                    }
                }

                // 1a. Try high accuracy native (10s timeout, 5 min maximumAge)
                try {
                    const position = await Geolocation.getCurrentPosition({
                        enableHighAccuracy: options?.enableHighAccuracy ?? true,
                        timeout: 10000,
                        maximumAge: maxAge
                    });
                    if (position && position.coords) {
                        return {
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                            accuracy: position.coords.accuracy,
                            timestamp: position.timestamp
                        };
                    }
                } catch (highErr) {
                    console.warn("[getCurrentLocation] Native high accuracy failed, trying low accuracy / cached fix:", highErr);
                }

                // 1b. Try low accuracy native (8s timeout, 10 min maximumAge)
                try {
                    const position = await Geolocation.getCurrentPosition({
                        enableHighAccuracy: false,
                        timeout: 8000,
                        maximumAge: 600000
                    });
                    if (position && position.coords) {
                        return {
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                            accuracy: position.coords.accuracy,
                            timestamp: position.timestamp
                        };
                    }
                } catch (lowErr) {
                    console.warn("[getCurrentLocation] Native low accuracy also failed:", lowErr);
                }
            } catch (nativeErr) {
                console.warn("[getCurrentLocation] Native Capacitor Geolocation error:", nativeErr);
            }
        }

        // 2. Web / Browser fallback (Standard W3C Geolocation API)
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
            return new Promise<LocationData | null>((resolve) => {
                // Try high accuracy browser first (10s timeout, 5 min maximumAge)
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        resolve({
                            latitude: pos.coords.latitude,
                            longitude: pos.coords.longitude,
                            lat: pos.coords.latitude,
                            lng: pos.coords.longitude,
                            accuracy: pos.coords.accuracy,
                            timestamp: pos.timestamp
                        });
                    },
                    (err) => {
                        console.warn("[getCurrentLocation] Browser high accuracy failed, trying low accuracy / cached fix:", err.message);
                        // Fallback to low accuracy with 10 min cache
                        navigator.geolocation.getCurrentPosition(
                            (pos2) => {
                                resolve({
                                    latitude: pos2.coords.latitude,
                                    longitude: pos2.coords.longitude,
                                    lat: pos2.coords.latitude,
                                    lng: pos2.coords.longitude,
                                    accuracy: pos2.coords.accuracy,
                                    timestamp: pos2.timestamp
                                });
                            },
                            (err2) => {
                                console.warn("[getCurrentLocation] Browser low accuracy also failed:", err2.message);
                                resolve(null);
                            },
                            { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
                        );
                    },
                    { enableHighAccuracy: options?.enableHighAccuracy ?? true, timeout: 10000, maximumAge: maxAge }
                );
            });
        }

        return null;
    })();

    return await Promise.race([getLocPromise, masterTimeoutPromise]);
};
