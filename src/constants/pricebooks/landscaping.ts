import { ProposalPreset } from 'types';

export const LANDSCAPING_MASTER_BOOK: Omit<ProposalPreset, 'id' | 'organizationId'>[] = [
    // 1. DIAGNOSTICS, CONSULTATION & DESIGN
    { name: 'Irrigation Diagnostic - Level 1', description: 'Standard troubleshooting for localized zone failures or pressure issues during business hours.', baseCost: 0, avgLabor: 1, category: 'Diagnostics' },
    { name: 'Irrigation Diagnostic - Level 2 (Wire Tracing)', description: 'Advanced troubleshooting involving wire locating, fault finding, or multi-valve failures.', baseCost: 15, avgLabor: 2, category: 'Diagnostics' },
    { name: 'Landscape Design Consultation', description: 'On-site meeting to discuss design goals, plant selection, and site measurements.', baseCost: 0, avgLabor: 1.5, category: 'Diagnostics' },
    { name: 'Soil Analysis & PH Testing', description: 'Collection and processing of soil samples to determine nutrient requirements.', baseCost: 45, avgLabor: 1, category: 'Diagnostics' },
    { name: 'Full Irrigation System Audit', description: 'Comprehensive check of all heads, valves, and controller for efficiency and coverage.', baseCost: 0, avgLabor: 2.5, category: 'Diagnostics' },
    { name: 'Drainage Evaluation & Slope Check', description: 'Professional assessment of site runoff and standing water issues.', baseCost: 0, avgLabor: 1, category: 'Diagnostics' },

    // 2. IRRIGATION REPAIR - HEADS & NOZZLES
    { name: 'Sprinkler Head - 4" Pop-Up (Replace)', description: 'Replace failed 4" spray head with professional grade unit (Rainbird/Hunter).', baseCost: 12, avgLabor: 0.5, category: 'Plumbing' },
    { name: 'Sprinkler Head - 6" Pop-Up (Replace)', description: 'Replace failed 6" spray head in taller turf or beds.', baseCost: 18, avgLabor: 0.5, category: 'Plumbing' },
    { name: 'Sprinkler Head - 12" Pop-Up (Replace)', description: 'Replace failed 12" spray head in dense landscape beds.', baseCost: 28, avgLabor: 0.75, category: 'Plumbing' },
    { name: 'Rotor Head - Pro Grade (Replace)', description: 'Replace standard gear-driven rotor head (Hunter PGP or similar).', baseCost: 24, avgLabor: 0.75, category: 'Plumbing' },
    { name: 'Rotor Head - Large Radius / High Flow', description: 'Replace high-capacity rotor for large turf areas.', baseCost: 45, avgLabor: 1, category: 'Plumbing' },
    { name: 'Spray Nozzle - Replacement', description: 'Replace clogged or damaged spray nozzle (Includes adjustment).', baseCost: 3, avgLabor: 0.25, category: 'Plumbing' },
    { name: 'MP Rotator Nozzle - Upgrade', description: 'Install high-efficiency multi-stream rotating nozzle.', baseCost: 12, avgLabor: 0.3, category: 'Plumbing' },
    { name: 'Swing Pipe / Funny Pipe Repair', description: 'Repair flexible connection between lateral line and head.', baseCost: 5, avgLabor: 0.5, category: 'Plumbing' },
    { name: 'Head Adjustment & Cleaning', description: 'Precision arc and throw adjustment for optimal coverage.', baseCost: 0, avgLabor: 0.25, category: 'Maintenance' },

    // 3. IRRIGATION REPAIR - VALVES & HYDRAULICS
    { name: 'Irrigation Valve - 1" Inline (Replace)', description: 'Cut out and replace failed 1" zone control valve.', baseCost: 35, avgLabor: 2, category: 'Plumbing' },
    { name: 'Irrigation Valve - 1.5" - 2" (Replace)', description: 'Replacement of large diameter commercial grade valve.', baseCost: 85, avgLabor: 3, category: 'Plumbing' },
    { name: 'Valve Solenoid - Replacement', description: 'Replace failed 24V electromagnetic solenoid coil.', baseCost: 22, avgLabor: 0.75, category: 'Plumbing' },
    { name: 'Valve Diaphragm Kit - Installation', description: 'Internal rebuild of existing valve body to resolve leaks.', baseCost: 18, avgLabor: 1, category: 'Plumbing' },
    { name: 'Main Line Repair - PVC (Up to 1")', description: 'Repair high-pressure main supply line (Requires excavation).', baseCost: 15, avgLabor: 2.5, category: 'Plumbing' },
    { name: 'Main Line Repair - PVC (1.5" - 2")', description: 'Repair large diameter high-pressure main line.', baseCost: 35, avgLabor: 3.5, category: 'Plumbing' },
    { name: 'Lateral Line Repair - PVC/Poly', description: 'Repair zone distribution piping (Includes sleeve).', baseCost: 10, avgLabor: 1.5, category: 'Plumbing' },
    { name: 'Valve Box - Standard (Replace)', description: 'Replace damaged or sunken rectangular valve box.', baseCost: 25, avgLabor: 1.5, category: 'Plumbing' },
    { name: 'Drip Line Repair - Poly Tube', description: 'Repair punctured or cut 1/2" drip irrigation tubing.', baseCost: 5, avgLabor: 1, category: 'Plumbing' },
    { name: 'Pressure Regulator - Irrigation (Replace)', description: 'Replace failed high-to-low pressure conversion valve.', baseCost: 65, avgLabor: 2, category: 'Plumbing' },

    // 4. IRRIGATION CONTROLS & SENSORS
    { name: 'Controller - 6 Zone Indoor (Replace)', description: 'Supply and install standard digital irrigation timer.', baseCost: 110, avgLabor: 1.5, category: 'Accessories' },
    { name: 'Controller - 12 Zone Outdoor (Replace)', description: 'Install weather-protected multi-zone controller.', baseCost: 185, avgLabor: 2, category: 'Accessories' },
    { name: 'Wi-Fi Smart Controller Upgrade', description: 'Upgrade to Rachio/Hunter Hydrawise smart system.', baseCost: 250, avgLabor: 2.5, category: 'Accessories' },
    { name: 'Rain Sensor - Wireless', description: 'Install automatic system shut-off for rain events.', baseCost: 85, avgLabor: 1, category: 'Accessories' },
    { name: 'Master Valve Installation', description: 'Add main safety valve to prevent system flooding.', baseCost: 55, avgLabor: 3, category: 'Plumbing' },
    { name: 'Indexing Valve - Replacement', description: 'Replace specialized mechanical multi-zone valve.', baseCost: 120, avgLabor: 2.5, category: 'Plumbing' },

    // 5. MOWING & TURF MAINTENANCE
    { name: 'Mowing Service - Small Lot (< 5k sqft)', description: 'Mow, edge, trim, and blow hard surfaces.', baseCost: 5, avgLabor: 0.75, category: 'Maintenance' },
    { name: 'Mowing Service - Medium Lot (5k-10k sqft)', description: 'Mow, edge, trim, and blow hard surfaces.', baseCost: 8, avgLabor: 1.25, category: 'Maintenance' },
    { name: 'Mowing Service - Large Lot (10k-15k sqft)', description: 'Mow, edge, trim, and blow hard surfaces.', baseCost: 12, avgLabor: 2, category: 'Maintenance' },
    { name: 'String Trimming - Overgrown Area', description: 'Clearing tall weeds/grass in unmaintained areas.', baseCost: 5, avgLabor: 1, category: 'Maintenance' },
    { name: 'Edge Redefining - Hardscape', description: 'Vertical blade edging to clean lines along drives and walks.', baseCost: 0, avgLabor: 0.5, category: 'Maintenance' },
    { name: 'Leaf Removal - Standard Lot', description: 'Raking, blowing, and removal of seasonal leaf debris.', baseCost: 0, avgLabor: 3, category: 'Maintenance' },
    { name: 'Core Aeration - Residential Turf', description: 'Machine aeration to reduce soil compaction.', baseCost: 25, avgLabor: 2, category: 'Maintenance' },
    { name: 'Power Raking / Dethatching', description: 'Mechanical removal of excessive turf thatch layer.', baseCost: 15, avgLabor: 2.5, category: 'Maintenance' },

    // 6. FERTILIZATION & CHEMICALS
    { name: 'Turf Fertilizer - Balanced Application', description: 'Granular slow-release fertilizer for seasonal growth.', baseCost: 35, avgLabor: 0.5, category: 'Maintenance' },
    { name: 'Pre-Emergent Weed Control', description: 'Application to prevent crabgrass and seasonal weeds.', baseCost: 45, avgLabor: 0.5, category: 'Maintenance' },
    { name: 'Broadleaf Weed Spot Treatment', description: 'Liquid herbicide application for existing turf weeds.', baseCost: 15, avgLabor: 0.75, category: 'Maintenance' },
    { name: 'Bed Weed Control - Pre-Emergent', description: 'Granular application to landscape beds (Snapdragon/Preen).', baseCost: 25, avgLabor: 0.5, category: 'Maintenance' },
    { name: 'Insecticide - Turf Grub Treatment', description: 'Chemical control for subsurface turf pests.', baseCost: 55, avgLabor: 0.75, category: 'Maintenance' },
    { name: 'Winterizer Fertilizer Application', description: 'High-potassium application for root health.', baseCost: 40, avgLabor: 0.5, category: 'Maintenance' },

    // 7. TREE, SHRUB & BED CARE
    { name: 'Hedge Trimming - Low (Up to 4ft)', description: 'Pruning and shaping of established hedges (Per LF).', baseCost: 2, avgLabor: 0.1, category: 'Maintenance' },
    { name: 'Hedge Trimming - High (4ft - 8ft)', description: 'Pruning of tall screening hedges (Requires ladder).', baseCost: 5, avgLabor: 0.2, category: 'Maintenance' },
    { name: 'Tree Pruning - Canopy Lift (Ornamental)', description: 'Remove lower branches to clear paths/views.', baseCost: 10, avgLabor: 1.5, category: 'Maintenance' },
    { name: 'Shrub Removal - Small (Up to 3ft)', description: 'Dig out root ball and remove debris.', baseCost: 0, avgLabor: 1, category: 'Maintenance' },
    { name: 'Shrub Removal - Large (3ft - 6ft)', description: 'Major excavation and disposal of established shrub.', baseCost: 0, avgLabor: 2.5, category: 'Maintenance' },
    { name: 'Mulch Installation - Double Shred (Per Yd)', description: 'Supply and spread hardwood mulch.', baseCost: 45, avgLabor: 1.5, category: 'Maintenance' },
    { name: 'Mulch Installation - Pine Straw (Per Bale)', description: 'Supply and spread seasonal pine straw.', baseCost: 8, avgLabor: 0.25, category: 'Maintenance' },
    { name: 'Decorative Stone / Gravel (Per Yd)', description: 'Supply and spread landscape rock or gravel.', baseCost: 95, avgLabor: 2, category: 'Maintenance' },
    { name: 'Bed Weeding - Manual Detail', description: 'Hand pulling weeds in highly visible bed areas.', baseCost: 0, avgLabor: 1, category: 'Maintenance' },

    // 8. LANDSCAPE INSTALLATION
    { name: 'Sod Installation - Bermuda (Per Pallet)', description: 'Prep soil and install 450 sqft of Bermuda turf.', baseCost: 280, avgLabor: 6, category: 'Contracting' },
    { name: 'Sod Installation - St. Augustine (Per Pallet)', description: 'Prep soil and install 450 sqft of premium shade turf.', baseCost: 350, avgLabor: 6, category: 'Contracting' },
    { name: 'Plant Installation - 1 Gallon Shrub', description: 'Dig, plant, and initial watering.', baseCost: 15, avgLabor: 0.4, category: 'Contracting' },
    { name: 'Plant Installation - 3 Gallon Shrub', description: 'Dig, plant, and initial watering.', baseCost: 32, avgLabor: 0.6, category: 'Contracting' },
    { name: 'Landscape Edging - Steel (Per LF)', description: 'Install heavy duty professional steel edging.', baseCost: 4.5, avgLabor: 0.15, category: 'Contracting' },
    { name: 'Landscape Edging - Composite/Poly (Per LF)', description: 'Install hammer-in landscape border.', baseCost: 2.5, avgLabor: 0.1, category: 'Contracting' },
    { name: 'Topsoil / Screened Soil (Per Yd)', description: 'Supply and spread soil for low spots or bed prep.', baseCost: 55, avgLabor: 1.5, category: 'Contracting' },

    // 9. HARDSCAPE REPAIR & DRAINAGE
    { name: 'Paver Leveling - Small Area (to 25 sqft)', description: 'Lift pavers, add sand, level, and re-set.', baseCost: 25, avgLabor: 4, category: 'Contracting' },
    { name: 'French Drain Installation (Per LF)', description: 'Trench, gravel, perforated pipe, and backfill.', baseCost: 12, avgLabor: 0.8, category: 'Contracting' },
    { name: 'Downspout Extension - Buried (Per LF)', description: 'Connect gutter to underground drain line.', baseCost: 8, avgLabor: 0.5, category: 'Contracting' },
    { name: 'Catch Basin - 12x12 (Install)', description: 'Install drainage box in low spot for runoff collection.', baseCost: 65, avgLabor: 3, category: 'Contracting' },
    { name: 'Wall Stone Repair - Loose Caps', description: 'Clean and re-glue stone retaining wall caps.', baseCost: 15, avgLabor: 1.5, category: 'Contracting' },

    // 10. LANDSCAPE LIGHTING
    { name: 'Lighting Transformer - 300W (Replace)', description: 'Supply and install pro-grade stainless transformer.', baseCost: 285, avgLabor: 2, category: 'Electrical' },
    { name: 'LED Path Light - Fixture Replace', description: 'Replace damaged low-voltage pathway light.', baseCost: 55, avgLabor: 0.75, category: 'Electrical' },
    { name: 'LED Up-Light / Spot - Fixture Replace', description: 'Replace damaged tree or architectural spot light.', baseCost: 75, avgLabor: 0.75, category: 'Electrical' },
    { name: 'Lighting Bulb Swap - LED Upgrade', description: 'Convert halogen to energy efficient LED lamp.', baseCost: 15, avgLabor: 0.25, category: 'Electrical' },
    { name: 'Low Voltage Wire Repair - Direct Burial', description: 'Locate and splice cut lighting cable.', baseCost: 5, avgLabor: 1.5, category: 'Electrical' },
    { name: 'Lighting Photocell / Timer - Replace', description: 'Replace failed automatic dusk-to-dawn control.', baseCost: 25, avgLabor: 1, category: 'Electrical' },
];
