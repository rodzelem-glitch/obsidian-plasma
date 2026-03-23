
import { ProposalPreset } from '@types';

export const SOLAR_MASTER_BOOK: Omit<ProposalPreset, 'id' | 'organizationId'>[] = [
    // --- 1. DIAGNOSTICS & INSPECTION ---
    { name: 'Solar System Diagnostic - Standard', description: 'Standard troubleshooting for system underperformance, communication errors, or monitoring issues during business hours.', baseCost: 0, avgLabor: 1.5, category: 'Diagnostics' },
    { name: 'Solar System Diagnostic - Advanced (Ground/Arc Fault)', description: 'In-depth troubleshooting for DC ground faults, isolation faults, or arc faults requiring panel lifting and wire tracing.', baseCost: 0, avgLabor: 3.0, category: 'Diagnostics' },
    { name: 'Solar Site Survey & Audit', description: 'Comprehensive inspection of roof condition, electrical panel, and shading analysis for new installs or upgrades.', baseCost: 0, avgLabor: 2.0, category: 'Diagnostics' },
    { name: 'Thermal Imaging Inspection (Array)', description: 'Drone or handheld infrared scan to identify hotspots, bypass diode failures, or cell damage.', baseCost: 0, avgLabor: 1.0, category: 'Diagnostics' },
    { name: 'Commissioning / Re-commissioning', description: 'Software setup, firmware updates, map creation, and grid profile verification for inverters.', baseCost: 0, avgLabor: 1.5, category: 'Diagnostics' },
    { name: 'Performance Analysis Report', description: 'Detailed analysis of production data vs. expected output with shading report.', baseCost: 0, avgLabor: 1.0, category: 'Diagnostics' },

    // --- 2. CLEANING & MAINTENANCE ---
    { name: 'Solar Panel Cleaning - 1 Story (Per Panel)', description: 'Professional cleaning with deionized water and soft brush to remove dust, pollen, and grime.', baseCost: 2.00, avgLabor: 0.15, category: 'Maintenance' },
    { name: 'Solar Panel Cleaning - 2 Story / Steep (Per Panel)', description: 'Cleaning for high roofs or steep pitches requiring safety rigging.', baseCost: 3.00, avgLabor: 0.25, category: 'Maintenance' },
    { name: 'Critter Guard Installation (Per LF)', description: 'Install PVC-coated wire mesh around array perimeter to prevent birds and rodents nesting.', baseCost: 4.50, avgLabor: 0.3, category: 'Maintenance' },
    { name: 'System Tune-Up / Annual Maintenance', description: 'Torque check of connections, visual inspection of racking/wires, and inverter filter cleaning.', baseCost: 15, avgLabor: 2.0, category: 'Maintenance' },
    { name: 'Vegetation Trimming (Shading)', description: 'Trim minor tree branches causing shading on array (Ground level only).', baseCost: 0, avgLabor: 1.0, category: 'Maintenance' },
    { name: 'Under-Panel Debris Removal', description: 'Remove nests, leaves, and debris from under the array (Requires partial removal).', baseCost: 0, avgLabor: 3.0, category: 'Maintenance' },

    // --- 3. INVERTERS & OPTIMIZERS ---
    { name: 'Microinverter Replacement (Enphase/AP/Hoymiles)', description: 'Replace failed microinverter under panel. Includes map update. (Labor only, assuming warranty part).', baseCost: 25, avgLabor: 1.5, category: 'Solar' },
    { name: 'Power Optimizer Replacement (SolarEdge/Tigo)', description: 'Replace failed DC optimizer under panel. (Labor only, assuming warranty part).', baseCost: 25, avgLabor: 1.5, category: 'Solar' },
    { name: 'String Inverter Replacement (3-7.7kW)', description: 'Replace central string inverter (SMA/Fronius/SolarEdge). Includes commissioning.', baseCost: 1500, avgLabor: 3.0, category: 'Solar' },
    { name: 'String Inverter Replacement (8-11.4kW)', description: 'Replace large residential central inverter.', baseCost: 2200, avgLabor: 4.0, category: 'Solar' },
    { name: 'Communication Gateway Replacement', description: 'Replace Envoy, SetApp, or monitoring gateway device.', baseCost: 450, avgLabor: 1.5, category: 'Solar' },
    { name: 'CT Meter Installation (Consumption)', description: 'Install consumption monitoring current transformers in main panel.', baseCost: 85, avgLabor: 2.0, category: 'Electrical' },
    { name: 'Cellular Modem Kit Install', description: 'Install 4G/5G cell kit for monitoring systems without reliable Wi-Fi.', baseCost: 350, avgLabor: 1.0, category: 'Accessories' },

    // --- 4. PANELS (MODULES) ---
    { name: 'Solar Panel Replacement - Standard (300-350W)', description: 'Replace damaged PV module (Silver/Black frame).', baseCost: 250, avgLabor: 1.5, category: 'Solar' },
    { name: 'Solar Panel Replacement - Premium (360-400W+)', description: 'Replace high-efficiency PV module (LG/SunPower/REC/QCell).', baseCost: 380, avgLabor: 1.5, category: 'Solar' },
    { name: 'Remove & Reinstall - Per Panel (R&R)', description: 'Remove panel for roof repair/replacement and reinstall later. Includes storage.', baseCost: 25, avgLabor: 2.0, category: 'Solar' },
    { name: 'Panel Re-Clamping / Adjustment', description: 'Fix loose clamps, slipped panels, or realign array.', baseCost: 5, avgLabor: 0.5, category: 'Solar' },

    // --- 5. ELECTRICAL & BOS (Balance of System) ---
    { name: 'Combiner Box Replacement', description: 'Replace AC combiner or sub-panel on roof or wall.', baseCost: 250, avgLabor: 3.0, category: 'Electrical' },
    { name: 'DC Disconnect Replacement', description: 'Replace rooftop or wall-mounted DC disconnect switch.', baseCost: 85, avgLabor: 1.5, category: 'Electrical' },
    { name: 'AC Disconnect Replacement (Fused)', description: 'Replace fusible AC disconnect for inverter output.', baseCost: 65, avgLabor: 1.0, category: 'Electrical' },
    { name: 'PV Wire Repair (Per Splice)', description: 'Repair chewed or damaged PV wire with waterproof splice.', baseCost: 5, avgLabor: 0.5, category: 'Electrical' },
    { name: 'Conduit Repair - Roof Penetration', description: 'Reseal and repair leaking Soladeck or conduit penetration.', baseCost: 45, avgLabor: 1.5, category: 'Electrical' },
    { name: 'Conduit Run - EMT/Rigid (Per 10ft)', description: 'Replace or install exposed metal conduit.', baseCost: 35, avgLabor: 1.0, category: 'Electrical' },
    { name: 'MC4 Connector Replacement (Pair)', description: 'Replace burned or damaged MC4 connectors (Male & Female).', baseCost: 8, avgLabor: 0.25, category: 'Electrical' },
    { name: 'Main Panel Tap / Breaker Tie-in', description: 'Line side tap or breaker connection repair/replacement.', baseCost: 65, avgLabor: 2.0, category: 'Electrical' },
    { name: 'Solar Breaker Replacement (Backfed)', description: 'Replace backfed breaker in main service panel.', baseCost: 35, avgLabor: 0.75, category: 'Electrical' },

    // --- 6. MOUNTING & FLASHING ---
    { name: 'Rail Replacement (Per 10ft)', description: 'Replace bent or corroded aluminum racking rail (IronRidge/Unirac).', baseCost: 65, avgLabor: 1.0, category: 'Solar' },
    { name: 'Flashing / Standoff Replacement', description: 'Replace leaking roof attachment point or standoff.', baseCost: 35, avgLabor: 1.5, category: 'Solar' },
    { name: 'End Clamp / Mid Clamp Replacement', description: 'Replace seized or broken panel clamps.', baseCost: 5, avgLabor: 0.2, category: 'Solar' },
    { name: 'Grounding Lug / WEEB Clip Repair', description: 'Repair system grounding path or bonding washer.', baseCost: 3, avgLabor: 0.25, category: 'Solar' },
    { name: 'Tile Roof Hook Replacement', description: 'Replace broken tile hook or flashing.', baseCost: 45, avgLabor: 1.5, category: 'Solar' },

    // --- 7. BATTERY STORAGE ---
    { name: 'Battery Diagnostic / Firmware Update', description: 'Troubleshoot battery storage system (Powerwall/Encharge/SolarEdge).', baseCost: 0, avgLabor: 2.0, category: 'Diagnostics' },
    { name: 'Battery Add-on Installation (Labor Only)', description: 'Install additional battery module to existing system (Battery cost separate).', baseCost: 250, avgLabor: 8.0, category: 'Solar' },
    { name: 'Backup Gateway / Transfer Switch Repair', description: 'Repair automatic transfer switch components or gateway board.', baseCost: 150, avgLabor: 4.0, category: 'Electrical' },
    { name: 'Battery Fuse Replacement', description: 'Replace internal high-amperage fuse.', baseCost: 85, avgLabor: 1.5, category: 'Electrical' },

    // --- 8. EV CHARGING (Solar Integrated) ---
    { name: 'Solar EV Charger Install (Inverter Integrated)', description: 'Install EV charging cable directly to solar inverter (SolarEdge EV Inverter).', baseCost: 450, avgLabor: 2.5, category: 'Electrical' },
    { name: 'EV Charger Load Management', description: 'Install device to manage EV load dynamically with solar production.', baseCost: 250, avgLabor: 2.0, category: 'Electrical' },

    // --- 9. SYSTEM REMOVAL & DECOMMISSION ---
    { name: 'System Removal (Decommission) - Per Panel', description: 'Permanently remove panels, racking, and electrical to roof line.', baseCost: 15, avgLabor: 1.0, category: 'Demo' },
    { name: 'Roof Pitch Repair (Post Removal)', description: 'Seal lag holes with high-grade sealant/flashing after system removal.', baseCost: 5, avgLabor: 0.2, category: 'Demo' },
    { name: 'Inverter Removal & Disposal', description: 'Remove wall mounted inverter and conduit.', baseCost: 25, avgLabor: 1.5, category: 'Demo' },
];
