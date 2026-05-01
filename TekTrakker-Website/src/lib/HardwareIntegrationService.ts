import { BleClient, BleDevice, dataViewToText, dataViewToNumbers } from '@capacitor-community/bluetooth-le';
import showToast from './toast';

export interface HardwareReading {
    rawText?: string;
    rawNumbers?: number[];
    parsed?: any;
}

class HardwareIntegrationService {
    private isInitialized = false;

    async initialize() {
        if (this.isInitialized) return true;
        try {
            await BleClient.initialize();
            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error("BLE Initialization Error:", error);
            showToast.error("Failed to initialize Bluetooth. Ensure permissions are granted.");
            return false;
        }
    }

    /**
     * Generic scan that allows connecting to ANY device.
     * This caters to organizations using a mix of Fieldpiece, Testo, Yellow Jacket, or generic multimeters.
     */
    async discoverAndConnectGeneric(): Promise<BleDevice | null> {
        const ready = await this.initialize();
        if (!ready) return null;

        try {
            showToast.info("Scanning for any Bluetooth Smart Probes...");
            // By omitting 'services' array, we scan for ANY available device
            // The OS will present a native bottom-sheet picker of all nearby BLE devices
            const device = await BleClient.requestDevice({
                // You can add optionalServices here if you know common UUIDs
                // e.g., Battery Service: '0000180f-0000-1000-8000-00805f9b34fb'
            });

            await BleClient.connect(device.deviceId);
            showToast.success(`Connected to ${device.name || 'Unknown Device'}`);
            return device;
        } catch (error: any) {
            console.error("BLE Connect Error:", error);
            // User cancelled the prompt or connection failed
            if (error.message && !error.message.includes('cancelled')) {
                showToast.error("Could not connect to device.");
            }
            return null;
        }
    }

    async disconnect(deviceId: string) {
        try {
            await BleClient.disconnect(deviceId);
            showToast.info("Device disconnected.");
        } catch (error) {
            console.error("BLE Disconnect Error:", error);
        }
    }

    /**
     * Attempts to read all discoverable services and characteristics.
     * Because proprietary devices (like Fieldpiece/Testo) hide their data in custom hex payloads,
     * this generic reader will return raw data arrays that can be heuristically parsed or sent to an AI for extraction.
     */
    async sniffDeviceData(deviceId: string): Promise<HardwareReading[]> {
        const readings: HardwareReading[] = [];
        try {
            const services = await BleClient.getServices(deviceId);
            
            for (const service of services) {
                for (const char of service.characteristics) {
                    if (char.properties.read) {
                        try {
                            const value = await BleClient.read(deviceId, service.uuid, char.uuid);
                            readings.push({
                                rawText: dataViewToText(value),
                                rawNumbers: dataViewToNumbers(value)
                            });
                        } catch (e) {
                            // Some characteristics might fail to read depending on state, safely ignore
                        }
                    }
                }
            }
            return readings;
        } catch (error) {
            console.error("BLE Read Error:", error);
            showToast.error("Failed to read device data.");
            return [];
        }
    }

    // ==========================================
    // CLOUD API INTEGRATIONS (Fallback / Remote)
    // ==========================================
    
    /**
     * For organizations that link their accounts (MeasureQuick, Fieldpiece JobLink, etc.)
     * This will pull the latest readings from their cloud API instead of direct BLE.
     */
    async fetchCloudReadings(provider: 'fieldpiece' | 'testo' | 'measurequick', accountId: string) {
        // Placeholder for the actual server-side API calls
        showToast.info(`Fetching data from ${provider} cloud account...`);
        
        // Simulating network delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        return {
            success: true,
            data: {
                suctionPress: 118,
                suctionTemp: 58,
                liquidPress: 325,
                liquidTemp: 95
            }
        };
    }
}

export const HardwareAPI = new HardwareIntegrationService();
