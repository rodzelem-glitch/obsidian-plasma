
import { ProposalPreset } from '@types';

export const LANDSCAPING_MASTER_BOOK: Omit<ProposalPreset, 'id' | 'organizationId'>[] = [
    // --- 1. DIAGNOSTICS, CONSULTATION & AUDITS ---
    { name: 'Irrigation Diagnostic - Level 1 (Standard)', description: 'Standard troubleshooting for localized zone failures, broken heads, or pressure issues during business hours.', baseCost: 0, avgLabor: 1.0, category: 'Diagnostics' },
    { name: 'Irrigation Diagnostic - Level 2 (Wire Tracing)', description: 'Advanced troubleshooting involving valve locating, wire fault finding, or multi-zone failures.', baseCost: 15, avgLabor: 2.0, category: 'Diagnostics' },
    { name: 'Irrigation Diagnostic - Pump Start / Relay', description: 'Troubleshoot pump start relay or master valve issues.', baseCost: 0, avgLabor: 1.5, category: 'Diagnostics' },
    { name: 'Emergency Irrigation Service - After Hours', description: 'Priority dispatch for major leaks or system stuck on outside business hours.', baseCost: 0, avgLabor: 2.0, category: 'Diagnostics' },
    { name: 'Landscape Design Consultation', description: 'On-site meeting to discuss design goals, plant selection, hardscape, and site measurements.', baseCost: 0, avgLabor: 1.5, category: 'Diagnostics' },
    { name: 'Soil Analysis & PH Testing', description: 'Collection and lab processing of soil samples to determine nutrient requirements.', baseCost: 45, avgLabor: 1.0, category: 'Diagnostics' },
    { name: 'Full Irrigation System Audit (Residential)', description: 'Comprehensive check of all heads, valves, and controller for efficiency, coverage, and leaks.', baseCost: 0, avgLabor: 2.5, category: 'Diagnostics' },
    { name: 'Full Irrigation System Audit (Commercial)', description: 'Detailed zone-by-zone analysis for large commercial properties.', baseCost: 0, avgLabor: 4.0, category: 'Diagnostics' },
    { name: 'Drainage Evaluation & Slope Check', description: 'Professional assessment of site runoff, standing water issues, and grade.', baseCost: 0, avgLabor: 1.0, category: 'Diagnostics' },

    // --- 2. IRRIGATION - HEADS & NOZZLES ---
    { name: 'Sprinkler Head - 4" Pop-Up (Replace)', description: 'Replace failed 4" spray head with professional grade unit (Rainbird 1804/Hunter Pro-Spray).', baseCost: 6, avgLabor: 0.5, category: 'Irrigation' },
    { name: 'Sprinkler Head - 6" Pop-Up (Replace)', description: 'Replace failed 6" spray head in taller turf or beds.', baseCost: 12, avgLabor: 0.5, category: 'Irrigation' },
    { name: 'Sprinkler Head - 12" Pop-Up (Replace)', description: 'Replace failed 12" spray head in dense landscape beds.', baseCost: 18, avgLabor: 0.75, category: 'Irrigation' },
    { name: 'Rotor Head - Pro Grade (Replace)', description: 'Replace standard gear-driven rotor head (Hunter PGP/Rainbird 5000).', baseCost: 18, avgLabor: 0.75, category: 'Irrigation' },
    { name: 'Rotor Head - Stainless Steel Riser', description: 'Install heavy duty stainless steel rotor for high traffic areas.', baseCost: 35, avgLabor: 0.75, category: 'Irrigation' },
    { name: 'Rotor Head - Large Radius / High Flow', description: 'Replace high-capacity rotor (I-20/I-25) for large turf areas.', baseCost: 45, avgLabor: 1.0, category: 'Irrigation' },
    { name: 'Spray Nozzle - Standard (Replace)', description: 'Replace clogged or damaged spray nozzle (Includes filter and adjustment).', baseCost: 2, avgLabor: 0.25, category: 'Irrigation' },
    { name: 'MP Rotator Nozzle - Upgrade', description: 'Install high-efficiency multi-stream rotating nozzle (water saving).', baseCost: 10, avgLabor: 0.3, category: 'Irrigation' },
    { name: 'Swing Pipe / Funny Pipe Repair', description: 'Repair flexible connection between lateral line and head.', baseCost: 5, avgLabor: 0.5, category: 'Irrigation' },
    { name: 'Sprinkler Head Relocation (Short Distance)', description: 'Move head up to 2 feet to correct spacing or avoid obstruction.', baseCost: 15, avgLabor: 1.0, category: 'Irrigation' },
    { name: 'Head Adjustment & Cleaning', description: 'Precision arc and throw adjustment for optimal coverage.', baseCost: 0, avgLabor: 0.25, category: 'Maintenance' },
    { name: 'Convert Spray Zone to Drip', description: 'Cap heads and install retrofit drip manifold for bed efficiency.', baseCost: 45, avgLabor: 2.0, category: 'Irrigation' },

    // --- 3. IRRIGATION - VALVES & HYDRAULICS ---
    { name: 'Irrigation Valve - 1" Inline (Replace)', description: 'Cut out and replace failed 1" zone control valve (Hunter/Rainbird).', baseCost: 35, avgLabor: 2.0, category: 'Irrigation' },
    { name: 'Irrigation Valve - 1.5" - 2" (Replace)', description: 'Replacement of large diameter commercial grade valve.', baseCost: 85, avgLabor: 3.0, category: 'Irrigation' },
    { name: 'Valve Solenoid - Replacement', description: 'Replace failed 24V electromagnetic solenoid coil.', baseCost: 22, avgLabor: 0.75, category: 'Irrigation' },
    { name: 'Valve Diaphragm Kit - Rebuild', description: 'Internal rebuild of existing valve body to resolve leaks or stuck valves.', baseCost: 18, avgLabor: 1.0, category: 'Irrigation' },
    { name: 'Wire Connector / Waterproof Splice', description: 'Repair corroded wire connection at valve box with DBY connectors.', baseCost: 5, avgLabor: 0.5, category: 'Irrigation' },
    { name: 'Valve Box - Standard Rectangular (Replace)', description: 'Replace damaged or sunken valve box. Level to grade.', baseCost: 35, avgLabor: 1.5, category: 'Irrigation' },
    { name: 'Valve Box - 6" Round (Replace)', description: 'Replace round valve box.', baseCost: 15, avgLabor: 1.0, category: 'Irrigation' },
    { name: 'Locate Lost Valve (Wire Tracker)', description: 'Use electronic locator to find buried valve box.', baseCost: 10, avgLabor: 1.5, category: 'Diagnostics' },
    { name: 'Master Valve Installation', description: 'Add main safety valve to prevent system flooding when idle.', baseCost: 55, avgLabor: 3.0, category: 'Irrigation' },
    { name: 'Indexing Valve - Replacement (Cam)', description: 'Replace mechanical multi-zone indexing valve (Florida style).', baseCost: 95, avgLabor: 2.0, category: 'Irrigation' },

    // --- 4. IRRIGATION - PIPING & BACKFLOW ---
    { name: 'Main Line Repair - PVC (Up to 1")', description: 'Repair high-pressure main supply line leak (Requires excavation).', baseCost: 15, avgLabor: 2.5, category: 'Irrigation' },
    { name: 'Main Line Repair - PVC (1.5" - 2")', description: 'Repair large diameter high-pressure main line.', baseCost: 35, avgLabor: 3.5, category: 'Irrigation' },
    { name: 'Lateral Line Repair - PVC/Poly', description: 'Repair zone distribution piping leak.', baseCost: 10, avgLabor: 1.5, category: 'Irrigation' },
    { name: 'Drip Line Repair - Poly Tube', description: 'Repair punctured or cut 1/2" drip irrigation tubing.', baseCost: 5, avgLabor: 1.0, category: 'Irrigation' },
    { name: 'Pressure Regulator - Install/Replace', description: 'Install brass or plastic pressure regulator to protect system.', baseCost: 65, avgLabor: 2.0, category: 'Irrigation' },
    { name: 'Backflow Preventer - PVB 1" (Replace)', description: 'Replace Pressure Vacuum Breaker assembly.', baseCost: 160, avgLabor: 2.5, category: 'Irrigation' },
    { name: 'Backflow Preventer - RPZ 1" (Replace)', description: 'Replace Reduced Pressure Zone assembly.', baseCost: 350, avgLabor: 3.0, category: 'Irrigation' },
    { name: 'Backflow Testing & Certification', description: 'Annual testing required by municipality.', baseCost: 15, avgLabor: 1.0, category: 'Irrigation' },
    { name: 'Winterization / Blowout (Per Zone)', description: 'Purge system of water with compressed air to prevent freeze damage.', baseCost: 0, avgLabor: 0.25, category: 'Maintenance' },
    { name: 'Spring Start-Up & Turn On', description: 'Charge system, check for leaks, and adjust heads.', baseCost: 0, avgLabor: 1.5, category: 'Maintenance' },

    // --- 5. IRRIGATION - CONTROLS & SENSORS ---
    { name: 'Controller - 6 Zone Indoor (Replace)', description: 'Supply and install standard digital irrigation timer (Hunter X-Core/Rainbird).', baseCost: 90, avgLabor: 1.5, category: 'Irrigation' },
    { name: 'Controller - 12 Zone Outdoor (Replace)', description: 'Install weather-protected multi-zone controller.', baseCost: 185, avgLabor: 2.0, category: 'Irrigation' },
    { name: 'Wi-Fi Smart Controller Upgrade (8 Zone)', description: 'Upgrade to Rachio 3 or Hunter Hydrawise smart system.', baseCost: 220, avgLabor: 2.0, category: 'Irrigation' },
    { name: 'Wi-Fi Smart Controller Upgrade (16 Zone)', description: 'Upgrade to Rachio 3 or Hunter Hydrawise smart system.', baseCost: 280, avgLabor: 2.5, category: 'Irrigation' },
    { name: 'Rain Sensor - Wireless (Install)', description: 'Install automatic system shut-off for rain events.', baseCost: 85, avgLabor: 1.0, category: 'Irrigation' },
    { name: 'Flow Sensor Installation', description: 'Install flow meter to detect leaks and monitor usage (Requires compatible controller).', baseCost: 180, avgLabor: 3.0, category: 'Irrigation' },
    { name: 'Pump Start Relay Installation', description: 'Install relay to activate pump from controller.', baseCost: 65, avgLabor: 1.5, category: 'Irrigation' },

    // --- 6. LANDSCAPE LIGHTING ---
    { name: 'Lighting Transformer - 300W (Replace)', description: 'Supply and install pro-grade stainless steel multi-tap transformer.', baseCost: 285, avgLabor: 2.0, category: 'Electrical' },
    { name: 'Lighting Transformer - 600W (Replace)', description: 'Supply and install high capacity dual-tap transformer.', baseCost: 380, avgLabor: 2.5, category: 'Electrical' },
    { name: 'LED Path Light - Fixture Replace', description: 'Replace damaged low-voltage pathway light (Brass/Copper).', baseCost: 65, avgLabor: 0.75, category: 'Electrical' },
    { name: 'LED Up-Light / Spot - Fixture Replace', description: 'Replace damaged tree or architectural spot light.', baseCost: 85, avgLabor: 0.75, category: 'Electrical' },
    { name: 'Lighting Bulb Swap - LED Upgrade', description: 'Convert halogen bi-pin or wedge base to energy efficient LED.', baseCost: 10, avgLabor: 0.25, category: 'Electrical' },
    { name: 'Low Voltage Wire Repair - Direct Burial', description: 'Locate and splice cut lighting cable with waterproof connectors.', baseCost: 5, avgLabor: 1.5, category: 'Electrical' },
    { name: 'Lighting Photocell / Timer - Replace', description: 'Replace failed automatic dusk-to-dawn control module.', baseCost: 35, avgLabor: 1.0, category: 'Electrical' },
    { name: 'New Lighting Zone - Install (Per Fixture)', description: 'Trench wire and install new fixture (Fixture cost separate).', baseCost: 15, avgLabor: 1.5, category: 'Electrical' },

    // --- 7. LAWN MAINTENANCE (MOWING) ---
    { name: 'Mowing Service - Small Lot (< 5k sqft)', description: 'Mow, edge, trim, and blow hard surfaces.', baseCost: 5, avgLabor: 0.75, category: 'Maintenance' },
    { name: 'Mowing Service - Medium Lot (5k-10k sqft)', description: 'Mow, edge, trim, and blow hard surfaces.', baseCost: 8, avgLabor: 1.0, category: 'Maintenance' },
    { name: 'Mowing Service - Large Lot (10k-15k sqft)', description: 'Mow, edge, trim, and blow hard surfaces.', baseCost: 12, avgLabor: 1.5, category: 'Maintenance' },
    { name: 'Mowing Service - Estate / Acreage (Per Acre)', description: 'Tractor/Zero-turn mowing for large properties.', baseCost: 20, avgLabor: 1.5, category: 'Maintenance' },
    { name: 'String Trimming - Overgrown Area (Per Hr)', description: 'Clearing tall weeds/grass in unmaintained areas.', baseCost: 5, avgLabor: 1.0, category: 'Maintenance' },
    { name: 'Edge Redefining - Hardscape', description: 'Vertical blade edging to clean lines along drives and walks.', baseCost: 0, avgLabor: 0.5, category: 'Maintenance' },
    { name: 'Leaf Removal - Standard Lot', description: 'Raking, blowing, and removal of seasonal leaf debris.', baseCost: 0, avgLabor: 3.0, category: 'Maintenance' },
    { name: 'Core Aeration - Residential Turf', description: 'Machine aeration to reduce soil compaction and improve nutrient uptake.', baseCost: 25, avgLabor: 2.0, category: 'Maintenance' },
    { name: 'Power Raking / Dethatching', description: 'Mechanical removal of excessive turf thatch layer.', baseCost: 15, avgLabor: 2.5, category: 'Maintenance' },
    { name: 'Overseeding - Fescue/Rye (Per 1k sqft)', description: 'Application of premium grass seed after aeration.', baseCost: 45, avgLabor: 0.5, category: 'Maintenance' },

    // --- 8. FERTILIZATION & CHEMICALS ---
    { name: 'Turf Fertilizer - Balanced Application (Per 1k sqft)', description: 'Granular slow-release fertilizer for seasonal growth.', baseCost: 15, avgLabor: 0.25, category: 'Maintenance' },
    { name: 'Pre-Emergent Weed Control', description: 'Application to prevent crabgrass and seasonal weeds.', baseCost: 45, avgLabor: 0.5, category: 'Maintenance' },
    { name: 'Broadleaf Weed Spot Treatment', description: 'Liquid herbicide application for existing turf weeds.', baseCost: 15, avgLabor: 0.75, category: 'Maintenance' },
    { name: 'Bed Weed Control - Pre-Emergent', description: 'Granular application to landscape beds (Snapdragon/Preen).', baseCost: 25, avgLabor: 0.5, category: 'Maintenance' },
    { name: 'Insecticide - Turf Grub Treatment', description: 'Chemical control for subsurface turf pests.', baseCost: 55, avgLabor: 0.75, category: 'Maintenance' },
    { name: 'Mosquito Fogging Treatment', description: 'Barrier spray for mosquito control (approx 30 days).', baseCost: 35, avgLabor: 1.0, category: 'Maintenance' },
    { name: 'Tree/Shrub Deep Root Feeding', description: 'Injection of fertilizer into root zone of trees and shrubs.', baseCost: 25, avgLabor: 1.5, category: 'Maintenance' },

    // --- 9. TREE, SHRUB & BED CARE ---
    { name: 'Hedge Trimming - Low (Up to 4ft) (Per LF)', description: 'Pruning and shaping of established hedges.', baseCost: 0, avgLabor: 0.1, category: 'Maintenance' },
    { name: 'Hedge Trimming - High (4ft - 8ft) (Per LF)', description: 'Pruning of tall screening hedges (Requires ladder/poles).', baseCost: 0, avgLabor: 0.2, category: 'Maintenance' },
    { name: 'Tree Pruning - Canopy Lift (Small Tree)', description: 'Remove lower branches to clear paths/views.', baseCost: 0, avgLabor: 1.0, category: 'Maintenance' },
    { name: 'Tree Pruning - Canopy Lift (Medium Tree)', description: 'Limbing up medium trees (up to 15ft height work).', baseCost: 0, avgLabor: 2.5, category: 'Maintenance' },
    { name: 'Shrub Removal - Small (Up to 3ft)', description: 'Dig out root ball and remove debris.', baseCost: 0, avgLabor: 1.0, category: 'Maintenance' },
    { name: 'Shrub Removal - Large (3ft - 6ft)', description: 'Major excavation and disposal of established shrub.', baseCost: 0, avgLabor: 2.5, category: 'Maintenance' },
    { name: 'Mulch Installation - Brown/Black/Red (Per Yd)', description: 'Supply and spread double-shredded hardwood mulch.', baseCost: 45, avgLabor: 1.5, category: 'Maintenance' },
    { name: 'Mulch Installation - Pine Straw (Per Bale)', description: 'Supply and spread seasonal pine straw.', baseCost: 8, avgLabor: 0.25, category: 'Maintenance' },
    { name: 'Decorative Stone / River Rock (Per Yd)', description: 'Supply and spread landscape rock or gravel.', baseCost: 120, avgLabor: 3.0, category: 'Maintenance' },
    { name: 'Bed Weeding - Manual Detail (Per Hr)', description: 'Hand pulling weeds in highly visible bed areas.', baseCost: 0, avgLabor: 1.0, category: 'Maintenance' },
    { name: 'Bed Edging - Trenching (Per LF)', description: 'Re-defining natural soil edge for landscape beds.', baseCost: 0, avgLabor: 0.1, category: 'Maintenance' },

    // --- 10. LANDSCAPE INSTALLATION (SOFT/HARD) ---
    { name: 'Sod Installation - Bermuda (Per Pallet)', description: 'Prep soil and install 450 sqft of Bermuda turf.', baseCost: 280, avgLabor: 5.0, category: 'Contracting' },
    { name: 'Sod Installation - St. Augustine (Per Pallet)', description: 'Prep soil and install 450 sqft of premium shade turf.', baseCost: 350, avgLabor: 5.0, category: 'Contracting' },
    { name: 'Sod Installation - Zoysia (Per Pallet)', description: 'Prep soil and install 450 sqft of Zoysia turf.', baseCost: 380, avgLabor: 5.0, category: 'Contracting' },
    { name: 'Plant Installation - 1 Gallon Shrub', description: 'Dig, plant, fertilize and initial watering.', baseCost: 12, avgLabor: 0.4, category: 'Contracting' },
    { name: 'Plant Installation - 3 Gallon Shrub', description: 'Dig, plant, fertilize and initial watering.', baseCost: 28, avgLabor: 0.6, category: 'Contracting' },
    { name: 'Plant Installation - 15 Gallon Tree', description: 'Dig, plant, stake and mulch tree.', baseCost: 120, avgLabor: 1.5, category: 'Contracting' },
    { name: 'Seasonal Color - Annuals (Per Flat)', description: 'Install flat of 18-20 seasonal flowers.', baseCost: 25, avgLabor: 1.0, category: 'Contracting' },
    { name: 'Landscape Edging - Steel (Per LF)', description: 'Install heavy duty professional steel edging.', baseCost: 4.5, avgLabor: 0.15, category: 'Contracting' },
    { name: 'Landscape Edging - Chop Stone (Per LF)', description: 'Install mortared stone border.', baseCost: 8, avgLabor: 0.5, category: 'Contracting' },
    { name: 'Topsoil / Compost / Garden Mix (Per Yd)', description: 'Supply and spread soil for low spots or bed prep.', baseCost: 55, avgLabor: 1.5, category: 'Contracting' },
    { name: 'Landscape Fabric Installation (Per Sqft)', description: 'Install professional weed barrier under rock/mulch.', baseCost: 0.20, avgLabor: 0.05, category: 'Contracting' },

    // --- 11. DRAINAGE & EROSION CONTROL ---
    { name: 'French Drain Installation (Per LF)', description: 'Trench, gravel, perforated pipe, and backfill.', baseCost: 12, avgLabor: 1.0, category: 'Contracting' },
    { name: 'Downspout Extension - Buried (Per LF)', description: 'Connect gutter to underground solid PVC drain line to pop-up.', baseCost: 8, avgLabor: 0.75, category: 'Contracting' },
    { name: 'Catch Basin - 9x9 (Install)', description: 'Install drainage box in low spot for runoff collection.', baseCost: 45, avgLabor: 2.5, category: 'Contracting' },
    { name: 'Catch Basin - 12x12 (Install)', description: 'Install large drainage box in low spot.', baseCost: 65, avgLabor: 3.0, category: 'Contracting' },
    { name: 'Pop-Up Emitter Installation', description: 'Install discharge emitter at end of drain run.', baseCost: 25, avgLabor: 1.0, category: 'Contracting' },
    { name: 'Grading - Skid Steer (Per Hr)', description: 'Machine grading to correct positive drainage.', baseCost: 75, avgLabor: 1.0, category: 'Contracting' },
    { name: 'Dry Creek Bed Installation (Per LF)', description: 'Create rock drainage swale (Labor intensive).', baseCost: 35, avgLabor: 2.0, category: 'Contracting' },

    // --- 12. HARDSCAPE REPAIR ---
    { name: 'Paver Leveling - Small Area (to 25 sqft)', description: 'Lift pavers, add sand, level, and re-set.', baseCost: 25, avgLabor: 4.0, category: 'Contracting' },
    { name: 'Retaining Wall Repair - Re-Stack (Per Sqft)', description: 'Remove and re-install shifting block wall sections.', baseCost: 5, avgLabor: 2.0, category: 'Contracting' },
    { name: 'Flagstone Joint Repair (Per Sqft)', description: 'Remove loose mortar/sand and re-point joints.', baseCost: 2, avgLabor: 0.5, category: 'Contracting' },
    { name: 'Wall Stone Repair - Loose Caps', description: 'Clean and re-glue stone retaining wall caps.', baseCost: 15, avgLabor: 1.5, category: 'Contracting' },
    { name: 'Pressure Washing - Patio/Driveway (Per Sqft)', description: 'Surface cleaning of concrete or pavers.', baseCost: 0, avgLabor: 0.05, category: 'Maintenance' },
    { name: 'Paver Sealing (Per Sqft)', description: 'Apply wet-look or natural sealer to pavers.', baseCost: 0.75, avgLabor: 0.1, category: 'Maintenance' },
];
