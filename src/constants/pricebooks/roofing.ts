import { ProposalPreset } from 'types';

export const ROOFING_MASTER_BOOK: Omit<ProposalPreset, 'id' | 'organizationId'>[] = [
    // 1. INSPECTIONS & DIAGNOSTICS
    { name: 'Roof Inspection - Professional Audit', description: 'Comprehensive 50-point inspection including drone photos, core samples, and digital reporting.', baseCost: 0, avgLabor: 2, category: 'Diagnostics' },
    { name: 'Emergency Leak Search & Tarping', description: 'Immediate response to active leaks. Includes location and temporary dry-in with industrial tarp.', baseCost: 45, avgLabor: 2.5, category: 'Diagnostics' },
    { name: 'Moisture Survey - Infrared', description: 'Thermal imaging scan to identify trapped moisture within the roofing assembly.', baseCost: 0, avgLabor: 1.5, category: 'Diagnostics' },
    { name: 'Roof Certification (Real Estate)', description: 'Official inspection and 2-year certification for residential real estate transactions.', baseCost: 0, avgLabor: 1.5, category: 'Diagnostics' },
    { name: 'Hail / Storm Damage Assessment', description: 'Detailed damage report for insurance claims, including test squares and photos.', baseCost: 0, avgLabor: 2, category: 'Diagnostics' },

    // 2. SHINGLE REPAIRS & REPLACEMENTS
    { name: 'Shingle Repair - Minor (Under 5)', description: 'Replacement of up to 5 damaged or missing 3-tab or architectural shingles.', baseCost: 15, avgLabor: 1.5, category: 'Roofing' },
    { name: 'Shingle Repair - Moderate (Up to 1 Square)', description: 'Replacement of shingles in a localized area up to 100 sqft.', baseCost: 110, avgLabor: 4, category: 'Roofing' },
    { name: 'Ridge Cap Replacement - Per 10ft', description: 'Remove and replace damaged high-profile ridge cap shingles.', baseCost: 45, avgLabor: 1.5, category: 'Roofing' },
    { name: 'Starter Strip Repair', description: 'Repair loosened or improperly installed starter course at eaves.', baseCost: 25, avgLabor: 2, category: 'Roofing' },
    { name: 'Plywood Decking Replacement (4x8)', description: 'Remove shingles and replace one sheet of rotted CDX plywood decking.', baseCost: 65, avgLabor: 2, category: 'Roofing' },
    { name: 'Step Flashing Repair / Rework', description: 'Remove siding and shingles to properly install or repair step flashing at wall.', baseCost: 15, avgLabor: 3, category: 'Roofing' },

    // 3. FLASHING & VENT BOOTS
    { name: 'Plumbing Pipe Boot - Standard (Replace)', description: 'Replace failed neoprene or lead pipe boot with new flashing.', baseCost: 22, avgLabor: 1, category: 'Roofing' },
    { name: 'Plumbing Pipe Boot - Ultimate Upgrade', description: 'Install lifetime silicone-capped pipe boot with UV protection.', baseCost: 45, avgLabor: 1.25, category: 'Roofing' },
    { name: 'Chimney Flashing - Counter Flashing Repair', description: 'Seal or replace surface-mounted metal counter flashing on brick chimney.', baseCost: 35, avgLabor: 3, category: 'Roofing' },
    { name: 'Valley Flashing Replacement - Per 10ft', description: 'Remove shingles and install new W-profile or open metal valley.', baseCost: 85, avgLabor: 4, category: 'Roofing' },
    { name: 'Drip Edge Replacement - Per 10ft', description: 'Install new T-style or F-style perimeter drip edge.', baseCost: 12, avgLabor: 1, category: 'Roofing' },
    { name: 'Wall Flashing / Apron Flashing (New)', description: 'Install custom bent flashing at roof-to-wall transitions.', baseCost: 25, avgLabor: 2, category: 'Roofing' },

    // 4. ATTIC VENTILATION
    { name: 'Static Box Vent (Install/Replace)', description: 'Install standard 750 slant-back roof vent.', baseCost: 18, avgLabor: 1, category: 'Roofing' },
    { name: 'Ridge Vent Installation - Per 4ft Section', description: 'Cut slot and install low-profile shingle-over ridge vent.', baseCost: 15, avgLabor: 0.75, category: 'Roofing' },
    { name: 'Power Attic Fan - Roof Mounted', description: 'Install 110V thermostatic controlled exhaust fan (Excludes Electric).', baseCost: 145, avgLabor: 2, category: 'Electrical' },
    { name: 'Solar Attic Fan - Installation', description: 'Install high-efficiency solar-powered roof exhaust fan.', baseCost: 350, avgLabor: 2, category: 'Roofing' },
    { name: 'Turbine Vent (Replace Head)', description: 'Replace noisy or seized 12" or 14" wind turbine head.', baseCost: 65, avgLabor: 1, category: 'Roofing' },
    { name: 'Soffit Vent Installation (Intake)', description: 'Cut and install under-eave intake vents for balanced airflow.', baseCost: 8, avgLabor: 1, category: 'Roofing' },

    // 5. GUTTERS & DOWNSPOUTS
    { name: 'Gutter Cleaning - Single Story (per LF)', description: 'Remove debris, flush downspouts, and inspect hangers.', baseCost: 0.1, avgLabor: 0.05, category: 'Maintenance' },
    { name: 'Gutter Cleaning - Multi Story (per LF)', description: 'Safety-certified debris removal for high-reach gutters.', baseCost: 0.15, avgLabor: 0.1, category: 'Maintenance' },
    { name: 'Gutter Resealing - Per Miter/Endcap', description: 'Clean and apply high-grade tri-polymer sealant to leaking joints.', baseCost: 15, avgLabor: 0.5, category: 'Roofing' },
    { name: 'Gutter Realignment - Per 20ft', description: 'Adjust pitch of existing gutter to ensure proper drainage.', baseCost: 0, avgLabor: 1, category: 'Roofing' },
    { name: 'Downspout Extension - Installation', description: 'Install 3x4 or 2x3 extension to move water away from foundation.', baseCost: 15, avgLabor: 0.5, category: 'Roofing' },
    { name: 'Gutter Guard - Micro Mesh (Per LF)', description: 'Supply and install premium leaf protection system.', baseCost: 4.5, avgLabor: 0.15, category: 'Roofing' },

    // 6. FLAT ROOF & COATINGS (MOD BIT / TPO / EPDM)
    { name: 'Flat Roof Patch - Torch Applied', description: 'Heat-fused 2-layer patch repair for Modified Bitumen roofs.', baseCost: 45, avgLabor: 2.5, category: 'Roofing' },
    { name: 'Flat Roof Patch - EPDM/TPO', description: 'Adhesive or heat-welded patch for single-ply membranes.', baseCost: 65, avgLabor: 2.5, category: 'Roofing' },
    { name: 'Roof Coating - Silicone (Per Square)', description: 'Apply high-solids silicone restorative coating (Includes Prep).', baseCost: 150, avgLabor: 3, category: 'Roofing' },
    { name: 'Roof Coating - Acrylic (Per Square)', description: 'Reflective elastomeric coating for UV protection.', baseCost: 85, avgLabor: 2, category: 'Roofing' },
    { name: 'Scupper / Collector Box Repair', description: 'Seal and reinforce drainage openings on flat roofs.', baseCost: 35, avgLabor: 2, category: 'Roofing' },

    // 7. METAL ROOFING
    { name: 'Metal Roof Screw Replacement - Per 100', description: 'Remove rusted fasteners and install new neoprene-gasketed screws.', baseCost: 45, avgLabor: 3, category: 'Roofing' },
    { name: 'Seam Sealing - Standing Seam', description: 'Apply commercial grade sealant or tape to problematic metal seams.', baseCost: 65, avgLabor: 2, category: 'Roofing' },
    { name: 'Metal Ridge Cap Resealing', description: 'Remove old sealant and apply high-grade butyl to ridge transitions.', baseCost: 25, avgLabor: 2, category: 'Roofing' },

    // 8. MISC ROOFING SERVICES
    { name: 'Skylight Resealing - Exterior', description: 'Apply specialized glazing sealant to curb and glass perimeter.', baseCost: 35, avgLabor: 2, category: 'Roofing' },
    { name: 'Satellite Dish Removal & Patch', description: 'Safely remove dish and permanently seal mounting holes.', baseCost: 5, avgLabor: 1, category: 'Roofing' },
    { name: 'Debris Removal - Heavy (Valley/Dead End)', description: 'Clear excessive needles/leaves causing damming and leaks.', baseCost: 0, avgLabor: 1.5, category: 'Maintenance' },
    { name: 'Snow Removal - Roof Raking', description: 'Removal of heavy snow loads to prevent ice damming.', baseCost: 0, avgLabor: 2, category: 'Maintenance' },
    { name: 'Zinc / Copper Strip Installation', description: 'Install preventative strips to inhibit moss and algae growth.', baseCost: 65, avgLabor: 2, category: 'Roofing' },
];
