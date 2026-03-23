
import { ProposalPreset } from '@types';

export const SECURITY_MASTER_BOOK: Omit<ProposalPreset, 'id' | 'organizationId'>[] = [
    // --- 1. DIAGNOSTICS & SERVICE ---
    { name: 'Security System Diagnostic - Level 1', description: 'Standard troubleshooting for single zone fault, low battery, or communication failure.', baseCost: 0, avgLabor: 1.0, category: 'Diagnostics' },
    { name: 'Security System Diagnostic - Level 2', description: 'Advanced troubleshooting for ground faults, panel programming corruption, or multi-device failure.', baseCost: 0, avgLabor: 2.0, category: 'Diagnostics' },
    { name: 'CCTV Diagnostic - Camera Offline', description: 'Troubleshoot video loss, power issues, or network connectivity for surveillance cameras.', baseCost: 0, avgLabor: 1.5, category: 'Diagnostics' },
    { name: 'Access Control Diagnostic', description: 'Troubleshoot door controller, reader, or locking hardware issues.', baseCost: 0, avgLabor: 2.0, category: 'Diagnostics' },
    { name: 'System Takeover / Programming', description: 'Reprogram existing panel for new monitoring service (Unlock installer code).', baseCost: 15, avgLabor: 1.5, category: 'Diagnostics' },

    // --- 2. INTRUSION ALARM SYSTEMS ---
    { name: 'Alarm Control Panel Replacement', description: 'Replace main board and enclosure (Honeywell/DSC/2GIG).', baseCost: 150, avgLabor: 2.5, category: 'Security' },
    { name: 'Keypad Installation - Touchscreen', description: 'Install modern touchscreen interface for alarm system.', baseCost: 185, avgLabor: 1.0, category: 'Security' },
    { name: 'Keypad Installation - Standard LCD', description: 'Install standard alphanumeric keypad.', baseCost: 85, avgLabor: 0.75, category: 'Security' },
    { name: 'Door/Window Sensor - Wireless', description: 'Install and program surface mount wireless contact.', baseCost: 25, avgLabor: 0.25, category: 'Security' },
    { name: 'Door/Window Sensor - Recessed', description: 'Drill and install concealed plunger contact.', baseCost: 15, avgLabor: 0.5, category: 'Security' },
    { name: 'Motion Detector - PIR (Pet Immune)', description: 'Install passive infrared motion sensor.', baseCost: 35, avgLabor: 0.5, category: 'Security' },
    { name: 'Glass Break Sensor - Acoustic', description: 'Install audio glass break detector.', baseCost: 45, avgLabor: 0.5, category: 'Security' },
    { name: 'Smoke/Heat Detector - Wireless', description: 'Install monitored fire safety device.', baseCost: 65, avgLabor: 0.5, category: 'Security' },
    { name: 'CO Detector - Wireless', description: 'Install monitored carbon monoxide detector.', baseCost: 75, avgLabor: 0.5, category: 'Security' },
    { name: 'Wireless Receiver / Transceiver', description: 'Install RF gateway to support wireless sensors.', baseCost: 55, avgLabor: 0.75, category: 'Security' },
    { name: 'Siren / Strobe Installation', description: 'Install interior or exterior audible alarm device.', baseCost: 35, avgLabor: 1.0, category: 'Security' },
    { name: 'Panic Button - Hardwired/Wireless', description: 'Install hold-up or panic alarm button.', baseCost: 45, avgLabor: 0.5, category: 'Security' },

    // --- 3. SURVEILLANCE (CCTV & IP CAMERAS) ---
    { name: 'IP Camera Install - Bullet (4MP)', description: 'Mount and aim high-definition bullet camera (PoE).', baseCost: 120, avgLabor: 1.5, category: 'Surveillance' },
    { name: 'IP Camera Install - Dome (Vandal)', description: 'Mount vandal-resistant dome camera.', baseCost: 145, avgLabor: 1.5, category: 'Surveillance' },
    { name: 'IP Camera Install - PTZ', description: 'Install Pan-Tilt-Zoom camera with bracket and power.', baseCost: 350, avgLabor: 3.0, category: 'Surveillance' },
    { name: 'Analog/TVI Camera Replacement', description: 'Replace legacy coax camera with HD-over-Coax unit.', baseCost: 65, avgLabor: 1.0, category: 'Surveillance' },
    { name: 'NVR Installation - 8 Channel', description: 'Install Network Video Recorder, mount HDD, and configure network.', baseCost: 250, avgLabor: 2.5, category: 'Surveillance' },
    { name: 'NVR Installation - 16 Channel', description: 'Install 16-channel NVR with rack mounting.', baseCost: 450, avgLabor: 3.5, category: 'Surveillance' },
    { name: 'Video Doorbell Pro Install', description: 'Install Wi-Fi video doorbell (Ring/Nest/Alarm.com).', baseCost: 180, avgLabor: 1.0, category: 'Surveillance' },
    { name: 'Camera Junction Box Mount', description: 'Install weather-sealed back box for camera connections.', baseCost: 25, avgLabor: 0.5, category: 'Surveillance' },
    { name: 'Power Supply Box (12V DC)', description: 'Install multi-camera fused power distribution box.', baseCost: 65, avgLabor: 1.5, category: 'Surveillance' },

    // --- 4. ACCESS CONTROL ---
    { name: 'Door Controller - 1 Door', description: 'Install single door networked access controller.', baseCost: 350, avgLabor: 3.0, category: 'Access Control' },
    { name: 'Card Reader - Proximity/Smart', description: 'Install mullion or single-gang card reader.', baseCost: 125, avgLabor: 1.0, category: 'Access Control' },
    { name: 'Maglock Installation (600lb)', description: 'Install magnetic lock on door frame.', baseCost: 160, avgLabor: 2.0, category: 'Access Control' },
    { name: 'Electric Strike Installation', description: 'Cut frame and install electric door strike.', baseCost: 185, avgLabor: 2.5, category: 'Access Control' },
    { name: 'Request to Exit (REX) Motion', description: 'Install PIR sensor for free egress.', baseCost: 65, avgLabor: 0.75, category: 'Access Control' },
    { name: 'Push to Exit Button', description: 'Install illuminated exit button.', baseCost: 45, avgLabor: 0.75, category: 'Access Control' },
    { name: 'Door Contact - Recessed (Access)', description: 'Install position sensor for door prop alarms.', baseCost: 15, avgLabor: 0.75, category: 'Access Control' },
    { name: 'Standalone Keypad Lock', description: 'Install battery-operated PIN code lock.', baseCost: 250, avgLabor: 1.5, category: 'Access Control' },

    // --- 5. INTERCOM & COMMUNICATION ---
    { name: 'Video Intercom Station (Door)', description: 'Install exterior video intercom unit.', baseCost: 350, avgLabor: 2.0, category: 'Intercom' },
    { name: 'Intercom Master Station (Desk/Wall)', description: 'Install interior answering station.', baseCost: 220, avgLabor: 1.0, category: 'Intercom' },
    { name: 'Telephone Entry System', description: 'Install multi-tenant telephone entry dialer.', baseCost: 1200, avgLabor: 5.0, category: 'Intercom' },
    { name: 'Aiphone System Power Supply', description: 'Replace dedicated intercom power supply.', baseCost: 85, avgLabor: 1.0, category: 'Intercom' },

    // --- 6. INFRASTRUCTURE & CABLING ---
    { name: 'Cat6 Cable Run - Plenum (Per Drop)', description: 'Pull, terminate, and test Cat6 cable for IP device.', baseCost: 45, avgLabor: 1.5, category: 'Cabling' },
    { name: 'Composite Access Control Cable Run', description: 'Pull multi-conductor cable (Banana Cable) for reader/lock.', baseCost: 85, avgLabor: 2.0, category: 'Cabling' },
    { name: 'Alarm Wire Run (22/4 or 22/2)', description: 'Pull wire for sensors or keypads.', baseCost: 15, avgLabor: 1.0, category: 'Cabling' },
    { name: 'Conduit Installation - EMT 1/2" (Per 10ft)', description: 'Surface mount conduit for protection.', baseCost: 12, avgLabor: 0.75, category: 'Infrastructure' },
    { name: 'Wire Mold / Surface Raceway (Per 6ft)', description: 'Install plastic surface raceway for finished areas.', baseCost: 18, avgLabor: 0.5, category: 'Infrastructure' },
    { name: 'Enclosure / Can - 14"', description: 'Mount metal structured wiring enclosure.', baseCost: 45, avgLabor: 1.0, category: 'Infrastructure' },

    // --- 7. SMART HOME & INTEGRATION ---
    { name: 'Smart Home Hub Setup', description: 'Configure Z-Wave/Zigbee controller for automation.', baseCost: 0, avgLabor: 1.5, category: 'Smart Home' },
    { name: 'Smart Lock Integration (Z-Wave)', description: 'Pair and configure smart deadbolt to alarm panel.', baseCost: 0, avgLabor: 0.75, category: 'Smart Home' },
    { name: 'Smart Thermostat Integration', description: 'Pair thermostat to security app ecosystem.', baseCost: 0, avgLabor: 0.5, category: 'Smart Home' },
    { name: 'Garage Door Controller Install', description: 'Install remote open/close relay and sensor.', baseCost: 65, avgLabor: 1.0, category: 'Smart Home' },
    { name: 'Water Shut-off Valve (Smart)', description: 'Install automated main water shut-off valve.', baseCost: 350, avgLabor: 2.5, category: 'Smart Home' },

    // --- 8. MAINTENANCE & MONITORING ---
    { name: 'Backup Battery - 12V 4Ah', description: 'Replace alarm panel backup battery.', baseCost: 18, avgLabor: 0.25, category: 'Maintenance' },
    { name: 'Backup Battery - 12V 7Ah', description: 'Replace standard alarm/access battery.', baseCost: 25, avgLabor: 0.25, category: 'Maintenance' },
    { name: 'Sensor Battery Replacement (Per 5)', description: 'Replace lithium batteries in wireless sensors.', baseCost: 25, avgLabor: 0.5, category: 'Maintenance' },
    { name: 'Communicator Upgrade - LTE/Cellular', description: 'Install 4G/5G cellular communicator for monitoring.', baseCost: 150, avgLabor: 1.0, category: 'Maintenance' },
    { name: 'Annual System Test & Inspection', description: 'Comprehensive test of all zones, siren, and communication.', baseCost: 0, avgLabor: 1.5, category: 'Maintenance' },
    { name: 'Firmware Update & Optimization', description: 'Update panel/NVR firmware and optimize settings.', baseCost: 0, avgLabor: 1.0, category: 'Maintenance' },
];
