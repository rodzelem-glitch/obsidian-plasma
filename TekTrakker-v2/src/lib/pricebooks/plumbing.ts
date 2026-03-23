
import { ProposalPreset } from '@types';

export const PLUMBING_MASTER_BOOK: Omit<ProposalPreset, 'id' | 'organizationId'>[] = [
    // --- 1. DIAGNOSTICS & TESTING ---
    { name: 'Diagnostic - Level 1 (Standard)', description: 'Standard site evaluation and troubleshooting for common residential plumbing issues (leaks, clogs, noises) during business hours.', baseCost: 0, avgLabor: 1.0, category: 'Diagnostics' },
    { name: 'Diagnostic - Level 2 (Advanced/Complex)', description: 'In-depth troubleshooting for intermittent issues, multiple fixture failures, or hidden piping problems.', baseCost: 0, avgLabor: 2.0, category: 'Diagnostics' },
    { name: 'Diagnostic - After Hours / Emergency', description: 'Priority dispatch and diagnosis performed on nights, weekends, or holidays.', baseCost: 0, avgLabor: 1.5, category: 'Diagnostics' },
    { name: 'Sewer Camera Inspection - Main Line', description: 'Visual inspection of main sewer lateral through accessible cleanout (up to 100ft) with recording.', baseCost: 0, avgLabor: 1.5, category: 'Diagnostics' },
    { name: 'Sewer Camera Inspection - Branch Line', description: 'Inspection of secondary lines (kitchen/laundry) using mini-camera.', baseCost: 0, avgLabor: 1.5, category: 'Diagnostics' },
    { name: 'Leak Detection - Electronic (Slab)', description: 'Ultrasonic/Electronic detection to pinpoint water leaks under concrete slabs or underground.', baseCost: 0, avgLabor: 3.0, category: 'Diagnostics' },
    { name: 'Leak Detection - Wall/Ceiling (Thermal)', description: 'Infrared thermal imaging scan to locate moisture paths behind finished surfaces.', baseCost: 0, avgLabor: 1.5, category: 'Diagnostics' },
    { name: 'Hydro-Static Pressure Test (Sewer)', description: 'Test sanitary sewer system integrity using test balls and water column.', baseCost: 25, avgLabor: 3.5, category: 'Diagnostics' },
    { name: 'Water Pressure Test (Static/Dynamic)', description: 'Measure static and residual water pressure to verify PRV operation and flow.', baseCost: 0, avgLabor: 0.5, category: 'Diagnostics' },
    { name: 'Dye Test - Toilet/Fixture', description: 'Fluorescent dye testing to identify silent leaks or cross-connections.', baseCost: 5, avgLabor: 0.5, category: 'Diagnostics' },
    { name: 'Gas Leak Search - Pressure Test', description: 'Air pressure test on gas system to identify leaks.', baseCost: 15, avgLabor: 2.0, category: 'Diagnostics' },

    // --- 2. DRAIN CLEANING ---
    { name: 'Kitchen Sink Drain Cleaning (Cable)', description: 'Cable cleaning of kitchen branch line from under-sink access (to 35ft).', baseCost: 5, avgLabor: 1.25, category: 'Plumbing' },
    { name: 'Lavatory/Tub Drain Cleaning (Cable)', description: 'Cable cleaning of bathroom branch lines (to 25ft).', baseCost: 5, avgLabor: 1.0, category: 'Plumbing' },
    { name: 'Shower Drain Cleaning', description: 'Remove hair/debris from trap and cable cleaning.', baseCost: 5, avgLabor: 1.0, category: 'Plumbing' },
    { name: 'Toilet Augering (Closet Auger)', description: 'Clearing local toilet blockage using professional hand auger (No removal).', baseCost: 0, avgLabor: 0.75, category: 'Plumbing' },
    { name: 'Main Sewer Auger (Standard Access)', description: 'Heavy duty machine cleaning of main sewer lateral from accessible cleanout (up to 75ft).', baseCost: 0, avgLabor: 2.0, category: 'Plumbing' },
    { name: 'Main Sewer Auger (Roof Vent Access)', description: 'Cleaning main line via roof vent (Two technician requirement for safety).', baseCost: 0, avgLabor: 3.5, category: 'Plumbing' },
    { name: 'Main Sewer Auger (Pull Toilet)', description: 'Remove toilet to access main line for cleaning, includes reset with new wax ring.', baseCost: 15, avgLabor: 3.0, category: 'Plumbing' },
    { name: 'Hydro-Jetting - Residential (Line Scour)', description: 'High-pressure water scouring of sewer lines to remove grease, scale, and sludge (up to 4").', baseCost: 65, avgLabor: 3.5, category: 'Plumbing' },
    { name: 'Hydro-Jetting - Commercial (Main Line)', description: 'Heavy duty jetting for commercial grease/waste lines.', baseCost: 120, avgLabor: 5.0, category: 'Plumbing' },
    { name: 'Root Destroyer Treatment', description: 'Application of foaming herbicide to kill roots in sewer line.', baseCost: 55, avgLabor: 0.5, category: 'Plumbing' },
    { name: 'Laundry Line Cleaning', description: 'Cable cleaning of laundry standpipe and branch.', baseCost: 5, avgLabor: 1.25, category: 'Plumbing' },

    // --- 3. WATER HEATERS (TANK TYPE) ---
    { name: 'Water Heater - 40 Gal Electric (Install)', description: 'Supply and install new 40-gallon electric tank. Includes removal/disposal of old unit.', baseCost: 550, avgLabor: 3.5, category: 'Plumbing' },
    { name: 'Water Heater - 50 Gal Electric (Install)', description: 'Supply and install new 50-gallon electric tank. Includes removal/disposal.', baseCost: 650, avgLabor: 3.5, category: 'Plumbing' },
    { name: 'Water Heater - 40 Gal Gas (Install)', description: 'Supply and install new 40-gallon atmospheric gas tank. Includes removal/disposal.', baseCost: 700, avgLabor: 4.5, category: 'Plumbing' },
    { name: 'Water Heater - 50 Gal Gas (Install)', description: 'Supply and install new 50-gallon atmospheric gas tank. Includes removal/disposal.', baseCost: 850, avgLabor: 4.5, category: 'Plumbing' },
    { name: 'Water Heater - Power Vent 50 Gal (Install)', description: 'Supply and install power vent gas water heater.', baseCost: 1400, avgLabor: 5.5, category: 'Plumbing' },
    { name: 'Expansion Tank - 2 Gallon (Install)', description: 'Install thermal expansion tank on cold water inlet (Required by code in many areas).', baseCost: 55, avgLabor: 1.5, category: 'Plumbing' },
    { name: 'T&P Valve Replacement', description: 'Replace failed Temperature & Pressure safety relief valve.', baseCost: 25, avgLabor: 1.0, category: 'Plumbing' },
    { name: 'Heating Element Replacement (Electric)', description: 'Replace upper or lower heating element.', baseCost: 20, avgLabor: 1.25, category: 'Plumbing' },
    { name: 'Thermostat Replacement (Electric WH)', description: 'Replace upper or lower thermostat.', baseCost: 25, avgLabor: 1.0, category: 'Plumbing' },
    { name: 'Gas Control Valve Replacement (Standard)', description: 'Replace gas control valve/thermostat on tank.', baseCost: 160, avgLabor: 2.0, category: 'Plumbing' },
    { name: 'Thermocouple / Pilot Assembly', description: 'Replace pilot safety assembly.', baseCost: 35, avgLabor: 1.25, category: 'Plumbing' },
    { name: 'Anode Rod Replacement', description: 'Replace sacrificial anode rod to extend tank life.', baseCost: 45, avgLabor: 1.5, category: 'Maintenance' },
    { name: 'Water Heater Flush & Service', description: 'Drain and flush sediment from tank, check safety components.', baseCost: 0, avgLabor: 1.5, category: 'Maintenance' },
    { name: 'Water Heater Pan & Drain Install', description: 'Install emergency overflow pan and pipe to exterior.', baseCost: 45, avgLabor: 2.5, category: 'Plumbing' },

    // --- 4. WATER HEATERS (TANKLESS) ---
    { name: 'Tankless Water Heater - Gas (Install)', description: 'Supply and install high-efficiency condensing gas tankless unit (Navien/Rinnai).', baseCost: 1600, avgLabor: 10.0, category: 'Plumbing' },
    { name: 'Tankless Descaling / Flush', description: 'Circulate vinegar/solution to remove scale build-up from heat exchanger.', baseCost: 25, avgLabor: 1.5, category: 'Maintenance' },
    { name: 'Tankless Isolation Valve Kit', description: 'Install service valves for future maintenance.', baseCost: 120, avgLabor: 2.5, category: 'Plumbing' },
    { name: 'Tankless Condensate Neutralizer', description: 'Install neutralizer kit for acidic condensate.', baseCost: 65, avgLabor: 1.0, category: 'Plumbing' },
    { name: 'Tankless Venting Modification', description: 'Upgrade venting to PVC/CPVC for condensing unit.', baseCost: 150, avgLabor: 3.0, category: 'Plumbing' },

    // --- 5. TOILETS ---
    { name: 'Toilet Rebuild - Complete', description: 'Replace fill valve, flapper/flush valve, handle, and tank-to-bowl bolts/gasket.', baseCost: 55, avgLabor: 1.5, category: 'Plumbing' },
    { name: 'Toilet Fill Valve Replacement', description: 'Replace fluidmaster fill valve.', baseCost: 15, avgLabor: 0.75, category: 'Plumbing' },
    { name: 'Toilet Flapper Replacement', description: 'Replace leaking flapper.', baseCost: 8, avgLabor: 0.5, category: 'Plumbing' },
    { name: 'Toilet Pull & Reset (New Wax Ring)', description: 'Remove toilet, clean flange, install new wax ring and bolts, reset toilet.', baseCost: 10, avgLabor: 1.5, category: 'Plumbing' },
    { name: 'Toilet Install - Standard (Client Provided)', description: 'Install customer supplied toilet. Includes new wax ring/bolts.', baseCost: 10, avgLabor: 2.0, category: 'Plumbing' },
    { name: 'Toilet Install - Pro Grade (Supplied)', description: 'Supply and install Gerber/Kohler elongated high-efficiency toilet.', baseCost: 220, avgLabor: 2.0, category: 'Plumbing' },
    { name: 'Toilet Install - Skirted (Supplied)', description: 'Supply and install skirted trapway toilet (Complex install).', baseCost: 350, avgLabor: 3.0, category: 'Plumbing' },
    { name: 'Toilet Flange Repair', description: 'Repair broken or rusted closet flange.', baseCost: 45, avgLabor: 2.0, category: 'Plumbing' },
    { name: 'Bidet Seat Installation', description: 'Install bidet seat attachment to existing toilet.', baseCost: 45, avgLabor: 1.25, category: 'Plumbing' },

    // --- 6. FAUCETS & SINKS ---
    { name: 'Faucet Replacement - Lavatory (Standard)', description: 'Supply and install 4" centerset bathroom faucet.', baseCost: 85, avgLabor: 1.5, category: 'Plumbing' },
    { name: 'Faucet Replacement - Lavatory (Widespread)', description: 'Supply and install 8" widespread bathroom faucet.', baseCost: 160, avgLabor: 2.5, category: 'Plumbing' },
    { name: 'Faucet Replacement - Kitchen (Standard)', description: 'Supply and install pull-out kitchen faucet.', baseCost: 180, avgLabor: 2.0, category: 'Plumbing' },
    { name: 'Faucet Install - Customer Provided', description: 'Install customer supplied faucet.', baseCost: 5, avgLabor: 1.5, category: 'Plumbing' },
    { name: 'Cartridge Replacement - Single Handle', description: 'Replace leaking cartridge in faucet.', baseCost: 45, avgLabor: 1.0, category: 'Plumbing' },
    { name: 'Pop-Up Assembly Replacement', description: 'Replace bathroom sink drain assembly.', baseCost: 25, avgLabor: 1.0, category: 'Plumbing' },
    { name: 'Basket Strainer Replacement', description: 'Replace kitchen sink basket strainer assembly.', baseCost: 25, avgLabor: 1.25, category: 'Plumbing' },
    { name: 'Tubular P-Trap Replacement', description: 'Replace under-sink P-trap (PVC/Poly).', baseCost: 15, avgLabor: 0.75, category: 'Plumbing' },

    // --- 7. GARBAGE DISPOSALS ---
    { name: 'Garbage Disposal - 1/3 HP (Install)', description: 'Supply and install Badger 1 or equivalent.', baseCost: 110, avgLabor: 1.5, category: 'Plumbing' },
    { name: 'Garbage Disposal - 1/2 HP (Install)', description: 'Supply and install Badger 5 or equivalent.', baseCost: 135, avgLabor: 1.5, category: 'Plumbing' },
    { name: 'Garbage Disposal - 3/4 HP (Install)', description: 'Supply and install high-torque disposal.', baseCost: 210, avgLabor: 1.75, category: 'Plumbing' },
    { name: 'Garbage Disposal - 1 HP (Pro Series)', description: 'Supply and install premium quiet disposal.', baseCost: 320, avgLabor: 2.0, category: 'Plumbing' },
    { name: 'Garbage Disposal - Jam Release', description: 'Clear jammed disposal and reset.', baseCost: 0, avgLabor: 0.75, category: 'Plumbing' },

    // --- 8. SHOWERS & TUBS ---
    { name: 'Shower Cartridge Replacement', description: 'Replace pressure balance shower cartridge (Moen/Delta).', baseCost: 65, avgLabor: 1.5, category: 'Plumbing' },
    { name: 'Shower Valve Replacement (Access Panel)', description: 'Replace shower valve body through access panel.', baseCost: 180, avgLabor: 4.0, category: 'Plumbing' },
    { name: 'Shower Valve Replacement (Tile Cut)', description: 'Replace shower valve requiring tile cut and repair plate.', baseCost: 250, avgLabor: 6.0, category: 'Plumbing' },
    { name: 'Tub Spout Replacement', description: 'Replace diverter tub spout.', baseCost: 35, avgLabor: 0.75, category: 'Plumbing' },
    { name: 'Shower Trim Kit Installation', description: 'Install new handle, trim plate, and shower head.', baseCost: 85, avgLabor: 1.5, category: 'Plumbing' },
    { name: 'Tub Waste & Overflow Replacement', description: 'Replace drain assembly on bathtub.', baseCost: 65, avgLabor: 2.5, category: 'Plumbing' },
    { name: 'Shower Pan Liner Repair (Estimate)', description: 'Repair leaking shower pan (Labor intensive).', baseCost: 150, avgLabor: 16.0, category: 'Plumbing' },

    // --- 9. PIPING, VALVES & SUPPLY ---
    { name: 'PRV - Pressure Reducing Valve (Replace)', description: 'Replace main water pressure regulator (3/4" - 1").', baseCost: 120, avgLabor: 2.5, category: 'Plumbing' },
    { name: 'Main Shut-off Valve (Replace)', description: 'Replace main house shut-off valve (Ball valve).', baseCost: 45, avgLabor: 2.0, category: 'Plumbing' },
    { name: 'Angle Stop Replacement', description: 'Replace fixture shut-off valve (1/4 turn).', baseCost: 12, avgLabor: 0.5, category: 'Plumbing' },
    { name: 'Supply Line - Braided Stainless', description: 'Replace fixture supply line.', baseCost: 8, avgLabor: 0.25, category: 'Plumbing' },
    { name: 'Hose Bibb - Standard', description: 'Replace outdoor sillcock.', baseCost: 25, avgLabor: 1.5, category: 'Plumbing' },
    { name: 'Hose Bibb - Frost Proof', description: 'Install frost-free outdoor faucet.', baseCost: 45, avgLabor: 2.5, category: 'Plumbing' },
    { name: 'Washing Machine Hoses (Pair)', description: 'Install braided stainless steel washer hoses.', baseCost: 30, avgLabor: 0.5, category: 'Plumbing' },
    { name: 'Washing Machine Valves (Oatey Box)', description: 'Replace washer box valves.', baseCost: 65, avgLabor: 3.0, category: 'Plumbing' },
    { name: 'Vacuum Breaker Replacement', description: 'Replace irrigation backflow preventer bonnet/poppet.', baseCost: 45, avgLabor: 1.0, category: 'Plumbing' },
    { name: 'Pipe Repair - Spot (Copper/PEX)', description: 'Repair pinhole leak or burst pipe section (accessible).', baseCost: 15, avgLabor: 2.0, category: 'Plumbing' },
    { name: 'Repipe - Whole House (Estimate)', description: 'Replace all supply piping with PEX.', baseCost: 800, avgLabor: 40.0, category: 'Plumbing' },
    { name: 'Sewer Line Spot Repair (Excavation)', description: 'Dig and repair broken sewer section (up to 5ft deep).', baseCost: 150, avgLabor: 8.0, category: 'Plumbing' },
    { name: 'Sewer Cleanout Installation', description: 'Install two-way cleanout for main line access.', baseCost: 120, avgLabor: 6.0, category: 'Plumbing' },

    // --- 10. GAS PIPING ---
    { name: 'Gas Flex Line (Appliance)', description: 'Replace gas connector for range, dryer, or water heater.', baseCost: 35, avgLabor: 1.0, category: 'Plumbing' },
    { name: 'Gas Shut-off Valve', description: 'Replace gas cock/valve.', baseCost: 25, avgLabor: 1.0, category: 'Plumbing' },
    { name: 'Gas Line Run (Per Ft)', description: 'Install black iron or CSST gas piping.', baseCost: 5, avgLabor: 0.5, category: 'Plumbing' },
    { name: 'Sediment Trap / Drip Leg', description: 'Install code-required drip leg on gas appliance.', baseCost: 15, avgLabor: 1.0, category: 'Plumbing' },

    // --- 11. PUMPS & SUMP ---
    { name: 'Sump Pump - 1/3 HP (Replace)', description: 'Supply and install submersible sump pump.', baseCost: 160, avgLabor: 2.0, category: 'Plumbing' },
    { name: 'Sump Pump - 1/2 HP (Replace)', description: 'Supply and install high-capacity sump pump.', baseCost: 210, avgLabor: 2.0, category: 'Plumbing' },
    { name: 'Battery Backup Sump System', description: 'Install secondary pump with battery backup.', baseCost: 450, avgLabor: 4.0, category: 'Plumbing' },
    { name: 'Sewage Ejector Pump', description: 'Replace sewage grinder/ejector pump.', baseCost: 480, avgLabor: 4.0, category: 'Plumbing' },
    { name: 'Check Valve - Sump/Ejector', description: 'Replace silent check valve.', baseCost: 35, avgLabor: 1.0, category: 'Plumbing' },
    { name: 'Recirculation Pump', description: 'Install hot water recirculation pump.', baseCost: 280, avgLabor: 3.0, category: 'Plumbing' },

    // --- 12. FILTRATION & TREATMENT ---
    { name: 'Whole House Filter (Cartridge)', description: 'Install big blue sediment/carbon filter housing.', baseCost: 150, avgLabor: 3.0, category: 'Plumbing' },
    { name: 'Water Softener Installation', description: 'Supply and install 32k-48k grain water softener.', baseCost: 850, avgLabor: 6.0, category: 'Plumbing' },
    { name: 'Reverse Osmosis System (Under Sink)', description: 'Install 5-stage RO drinking water system.', baseCost: 250, avgLabor: 3.0, category: 'Plumbing' },
    { name: 'Filter Change - Whole House', description: 'Replace main water filter cartridge.', baseCost: 35, avgLabor: 0.5, category: 'Maintenance' },
    { name: 'Filter Change - RO System', description: 'Replace pre/post filters and membrane.', baseCost: 65, avgLabor: 1.0, category: 'Maintenance' },

    // --- 13. SPECIALTY & MISC ---
    { name: 'Ice Maker Line Installation', description: 'Run water line to refrigerator.', baseCost: 45, avgLabor: 2.0, category: 'Plumbing' },
    { name: 'Hammer Arrestor Installation', description: 'Install water hammer arrestors to stop pipe banging.', baseCost: 35, avgLabor: 1.5, category: 'Plumbing' },
    { name: 'Access Panel Installation', description: 'Cut wall and install access panel for valves.', baseCost: 25, avgLabor: 1.0, category: 'Other' },
    { name: 'Appliance Installation - Dishwasher', description: 'Install dishwasher (connect water, drain, electric).', baseCost: 25, avgLabor: 2.5, category: 'Plumbing' },
];
