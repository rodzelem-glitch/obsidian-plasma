import { ProposalPreset } from 'types';

export const PLUMBING_MASTER_BOOK: Omit<ProposalPreset, 'id' | 'organizationId'>[] = [
    // 1. DIAGNOSTICS & TESTING
    { name: 'Diagnostic - Level 1 (Standard)', description: 'Standard site evaluation and troubleshooting for common residential plumbing issues during business hours.', baseCost: 0, avgLabor: 1, category: 'Diagnostics' },
    { name: 'Diagnostic - Level 2 (Multiple Issues)', description: 'Comprehensive evaluation for sites with complex or multiple plumbing concerns.', baseCost: 0, avgLabor: 1.75, category: 'Diagnostics' },
    { name: 'Diagnostic - After Hours Emergency', description: 'Priority dispatch and diagnosis performed outside standard business hours.', baseCost: 0, avgLabor: 1.5, category: 'Diagnostics' },
    { name: 'Sewer Camera Inspection - Level 1', description: 'Visual inspection of main sewer lateral through accessible cleanout (up to 100ft).', baseCost: 25, avgLabor: 1.5, category: 'Diagnostics' },
    { name: 'Sewer Camera Inspection - Level 2 (Recording)', description: 'Digital recording and locating of sewer defects with provided report and video file.', baseCost: 45, avgLabor: 2, category: 'Diagnostics' },
    { name: 'Leak Detection - Electronic (Slab)', description: 'Ultrasonic/Electronic detection to pinpoint water leaks under concrete slabs.', baseCost: 150, avgLabor: 3, category: 'Diagnostics' },
    { name: 'Hydro-Static Pressure Test', description: 'Test integrity of sanitary sewer system under slab using test ball and water level.', baseCost: 85, avgLabor: 4, category: 'Diagnostics' },
    { name: 'Water Pressure Test (Inbound)', description: 'Measure static and residual water pressure to verify PRV operation.', baseCost: 0, avgLabor: 0.5, category: 'Diagnostics' },
    { name: 'Dye Test - Toilet/Drain', description: 'Fluorescent dye testing to verify crossover or slow leaks in fixtures.', baseCost: 5, avgLabor: 0.5, category: 'Diagnostics' },
    { name: 'Thermal Imaging - Leak Location', description: 'Infrared scan to identify moisture patterns behind walls or under flooring.', baseCost: 0, avgLabor: 1, category: 'Diagnostics' },

    // 2. DRAIN CLEANING & ROOTER
    { name: 'Kitchen Sink Drain Cleaning (Snake)', description: 'Cable cleaning of kitchen branch line from under-sink access (to 25ft).', baseCost: 5, avgLabor: 1.5, category: 'Plumbing' },
    { name: 'Lavatory/Tub Drain Cleaning (Snake)', description: 'Cable cleaning of bathroom branch lines (to 25ft).', baseCost: 5, avgLabor: 1.25, category: 'Plumbing' },
    { name: 'Main Sewer Auger (to 75ft)', description: 'Heavy duty machine cleaning of main sewer lateral from accessible cleanout.', baseCost: 0, avgLabor: 2.5, category: 'Plumbing' },
    { name: 'Main Sewer Auger (to 100ft+)', description: 'Extended distance cable cleaning for long sewer runs.', baseCost: 0, avgLabor: 3.5, category: 'Plumbing' },
    { name: 'Hydro-Jetting - Residential (Up to 4")', description: 'High-pressure water scouring of sewer lines to remove grease, scale, and debris.', baseCost: 85, avgLabor: 4, category: 'Plumbing' },
    { name: 'Hydro-Jetting - Commercial Grade', description: 'Industrial pressure cleaning for larger lines or heavy grease buildup.', baseCost: 150, avgLabor: 6, category: 'Plumbing' },
    { name: 'Toilet Augering (Closet Auger)', description: 'Clearing local toilet blockage using professional hand auger.', baseCost: 0, avgLabor: 0.75, category: 'Plumbing' },
    { name: 'Urinal Drain Cleaning', description: 'Specialized cleaning for commercial urinal waste lines.', baseCost: 15, avgLabor: 2, category: 'Plumbing' },
    { name: 'Root Destroyer Treatment (Chemical)', description: 'Apply herbicidal foam to inhibit future root growth in sewer lines.', baseCost: 65, avgLabor: 0.5, category: 'Plumbing' },
    { name: 'Bio-Clean Drain Maintenance Kit', description: 'Bacteria-based enzymatic cleaner for ongoing drain health.', baseCost: 45, avgLabor: 0.25, category: 'Plumbing' },

    // 3. WATER HEATERS (STANDARD TANK)
    { name: 'Water Heater - 40 Gal Electric (Replace)', description: 'Supply and install new standard electric tank. Includes removal and disposal.', baseCost: 650, avgLabor: 4, category: 'Plumbing' },
    { name: 'Water Heater - 50 Gal Electric (Replace)', description: 'Supply and install new standard electric tank. Includes removal and disposal.', baseCost: 750, avgLabor: 4, category: 'Plumbing' },
    { name: 'Water Heater - 40 Gal Gas (Replace)', description: 'Supply and install atmospheric vent gas tank. Includes disposal and new flex lines.', baseCost: 850, avgLabor: 5, category: 'Plumbing' },
    { name: 'Water Heater - 50 Gal Gas (Replace)', description: 'Supply and install atmospheric vent gas tank. Includes disposal and new flex lines.', baseCost: 950, avgLabor: 5.5, category: 'Plumbing' },
    { name: 'Expansion Tank - 2 Gallon', description: 'Install thermal expansion tank on cold water inlet.', baseCost: 65, avgLabor: 1.5, category: 'Plumbing' },
    { name: 'T&P Valve Replacement', description: 'Replace failed Temperature & Pressure safety relief valve.', baseCost: 25, avgLabor: 1, category: 'Plumbing' },
    { name: 'Heating Element - Electric (Upper/Lower)', description: 'Replace failed electric heating element and gasket.', baseCost: 18, avgLabor: 1.5, category: 'Plumbing' },
    { name: 'Thermocouple - Gas Water Heater', description: 'Replace pilot safety thermocouple.', baseCost: 12, avgLabor: 1.25, category: 'Plumbing' },
    { name: 'Dip Tube Replacement', description: 'Replace broken cold water inlet dip tube.', baseCost: 15, avgLabor: 2, category: 'Plumbing' },
    { name: 'Anode Rod - Magnesium (Replace)', description: 'Replace sacrificial anode rod to extend tank life.', baseCost: 45, avgLabor: 1.5, category: 'Plumbing' },
    { name: 'Water Heater Flush & Safety Check', description: 'Annual sediment flush and comprehensive safety inspection.', baseCost: 0, avgLabor: 1.25, category: 'Maintenance' },

    // 4. WATER HEATERS (TANKLESS)
    { name: 'Tankless Water Heater - Gas (Replace)', description: 'Supply and install high-efficiency condensing gas tankless unit.', baseCost: 1800, avgLabor: 8, category: 'Plumbing' },
    { name: 'Tankless Descaling Service', description: 'Perform chemical flush to remove scale from tankless heat exchanger.', baseCost: 45, avgLabor: 2, category: 'Maintenance' },
    { name: 'Tankless Service Valve Kit', description: 'Install isolation valves for future tankless servicing.', baseCost: 145, avgLabor: 2.5, category: 'Plumbing' },

    // 5. TOILETS & BATHROOM FIXTURES
    { name: 'Toilet Rebuild - Full Kit', description: 'Replace fill valve, flapper, handle, and tank-to-bowl bolts.', baseCost: 45, avgLabor: 1.5, category: 'Plumbing' },
    { name: 'Toilet Reset (Wax Ring Replacement)', description: 'Pull toilet, replace wax seal and closet bolts, then reset.', baseCost: 12, avgLabor: 1.5, category: 'Plumbing' },
    { name: 'Toilet Replacement - Standard Grade', description: 'Supply and install 1.28 GPF elongated white toilet. Includes disposal.', baseCost: 210, avgLabor: 2.5, category: 'Plumbing' },
    { name: 'Toilet Replacement - Comfort Height', description: 'Supply and install ADO height elongated toilet. Includes disposal.', baseCost: 280, avgLabor: 2.5, category: 'Plumbing' },
    { name: 'Bidet Seat Installation', description: 'Install electronic or mechanical bidet attachment to existing toilet.', baseCost: 150, avgLabor: 1.5, category: 'Plumbing' },
    { name: 'Shower Cartridge Replacement', description: 'Replace failed pressure balance or thermostatic shower cartridge.', baseCost: 65, avgLabor: 1.5, category: 'Plumbing' },
    { name: 'Shower Valve Replacement (Major)', description: 'Cut out and replace entire shower valve body (Requires wall access).', baseCost: 185, avgLabor: 5, category: 'Plumbing' },
    { name: 'Bath Faucet Replacement', description: 'Supply and install standard 4" center-set lavatory faucet.', baseCost: 85, avgLabor: 2, category: 'Plumbing' },
    { name: 'Bath Faucet - Widespread Style', description: 'Supply and install 8" widespread lavatory faucet.', baseCost: 165, avgLabor: 2.5, category: 'Plumbing' },
    { name: 'Pop-up Drain Assembly (Bathroom)', description: 'Replace failed lavatory sink pop-up assembly.', baseCost: 22, avgLabor: 1, category: 'Plumbing' },

    // 6. KITCHEN FIXTURES
    { name: 'Kitchen Faucet - Single Handle Pullout', description: 'Supply and install standard grade kitchen faucet.', baseCost: 185, avgLabor: 2, category: 'Plumbing' },
    { name: 'Kitchen Faucet - Premium Grade', description: 'Supply and install high-end pull-down kitchen faucet.', baseCost: 350, avgLabor: 2.5, category: 'Plumbing' },
    { name: 'Garbage Disposal - 1/2 HP', description: 'Supply and install standard Badger 5 disposal.', baseCost: 145, avgLabor: 1.5, category: 'Plumbing' },
    { name: 'Garbage Disposal - 3/4 HP (Quiet)', description: 'Supply and install high-torque insulated disposal.', baseCost: 260, avgLabor: 1.5, category: 'Plumbing' },
    { name: 'Dishwasher Installation', description: 'Install new dishwasher. Includes water line and drain connection.', baseCost: 25, avgLabor: 2.5, category: 'Plumbing' },
    { name: 'Icemaker Water Line (PEX/Copper)', description: 'Run new water supply to refrigerator (up to 15ft).', baseCost: 45, avgLabor: 3, category: 'Plumbing' },
    { name: 'Basket Strainer Replacement', description: 'Replace failed stainless steel kitchen sink strainer.', baseCost: 18, avgLabor: 1, category: 'Plumbing' },

    // 7. PIPING & VALVES
    { name: 'PRV - Pressure Reducing Valve (Replace)', description: 'Replace failed main inbound water pressure regulator.', baseCost: 110, avgLabor: 2.5, category: 'Plumbing' },
    { name: 'Main Shut-off Valve (Replace)', description: 'Replace failed 3/4" or 1" ball valve for main supply.', baseCost: 35, avgLabor: 2, category: 'Plumbing' },
    { name: 'Hose Bibb - Standard Replacement', description: 'Replace external wall hydrant with new vacuum breaker model.', baseCost: 25, avgLabor: 1.5, category: 'Plumbing' },
    { name: 'Hose Bibb - Frost Proof (12")', description: 'Install freeze-protected outdoor faucet.', baseCost: 45, avgLabor: 2.5, category: 'Plumbing' },
    { name: 'Copper Pipe Repair (Small)', description: 'Cut out and solder repair for up to 1" copper line.', baseCost: 15, avgLabor: 1.5, category: 'Plumbing' },
    { name: 'PEX Pipe Repair (Small)', description: 'Cut out and crimp repair for up to 1" PEX line.', baseCost: 5, avgLabor: 1, category: 'Plumbing' },
    { name: 'Gas Line Repair (Interior)', description: 'Locate and repair leak in black iron gas piping.', baseCost: 25, avgLabor: 3, category: 'Plumbing' },
    { name: 'Angle Stop Replacement', description: 'Replace failed compression or solder shut-off valve under fixture.', baseCost: 12, avgLabor: 0.75, category: 'Plumbing' },
    { name: 'Supply Line - Braided Stainless', description: 'Replace fixture supply riser line.', baseCost: 8, avgLabor: 0.5, category: 'Plumbing' },
    { name: 'P-Trap Assembly Replacement', description: 'Replace under-sink plastic or chrome trap assembly.', baseCost: 15, avgLabor: 1, category: 'Plumbing' },

    // 8. WATER TREATMENT
    { name: 'Water Softener Installation', description: 'Supply and install 32k grain ion-exchange softener.', baseCost: 850, avgLabor: 6, category: 'Plumbing' },
    { name: 'Reverse Osmosis (RO) System', description: 'Supply and install 5-stage under-sink filtration system.', baseCost: 280, avgLabor: 3, category: 'Plumbing' },
    { name: 'Whole House Carbon Filter', description: 'Install in-line carbon filtration for chlorine removal.', baseCost: 450, avgLabor: 4, category: 'Plumbing' },
    { name: 'RO Filter Change Service', description: 'Replace all filters and sanitize RO holding tank.', baseCost: 85, avgLabor: 1.5, category: 'Maintenance' },

    // 9. OUTDOOR & SEWER MECHANICAL
    { name: 'Sump Pump Replacement (1/3 HP)', description: 'Supply and install new submersible sump pump.', baseCost: 185, avgLabor: 2, category: 'Plumbing' },
    { name: 'Sump Pump - Battery Backup System', description: 'Install redundant pump and battery failsafe.', baseCost: 550, avgLabor: 4, category: 'Plumbing' },
    { name: 'Sewage Ejector Pump Replacement', description: 'Supply and install grinder/ejector pump for basement waste.', baseCost: 650, avgLabor: 4, category: 'Plumbing' },
    { name: 'Sewer Cleanout Installation', description: 'Expose sewer line and install new 4" PVC cleanout to grade.', baseCost: 180, avgLabor: 6, category: 'Plumbing' },
    { name: 'Backflow Preventer - RPZ (1")', description: 'Install required backflow protection for irrigation.', baseCost: 280, avgLabor: 4, category: 'Plumbing' },
    { name: 'Backflow Annual Certification', description: 'Testing and certification of backflow device by licensed tech.', baseCost: 0, avgLabor: 1.5, category: 'Maintenance' },

    // 10. SPECIALIZED SERVICES
    { name: 'Gas Flex Line & Valve (Appliance)', description: 'Install new code-compliant gas flex and shut-off.', baseCost: 35, avgLabor: 1.5, category: 'Plumbing' },
    { name: 'Hammer Arrestor Installation', description: 'Install air chambers to resolve water hammer issues.', baseCost: 25, avgLabor: 1.5, category: 'Plumbing' },
    { name: 'Recirculation Pump Installation', description: 'Install "Instant Hot" pump at water heater or fixture.', baseCost: 220, avgLabor: 3, category: 'Plumbing' },
    { name: 'Expansion Tank - Hydronic', description: 'Replace closed-loop boiler expansion tank.', baseCost: 85, avgLabor: 2, category: 'Plumbing' },
];
