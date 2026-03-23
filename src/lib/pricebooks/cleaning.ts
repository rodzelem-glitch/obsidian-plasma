
import { ProposalPreset } from '@types';

export const CLEANING_MASTER_BOOK: Omit<ProposalPreset, 'id' | 'organizationId'>[] = [
    // --- 1. STANDARD RESIDENTIAL CLEANING ---
    { name: 'Standard Cleaning - Studio/1BA', description: 'Dusting, vacuuming, mopping, and basic surface sanitization for studio apartment.', baseCost: 10, avgLabor: 1.5, category: 'Maintenance' },
    { name: 'Standard Cleaning - 1BR/1BA', description: 'Dusting, vacuuming, mopping, and basic surface sanitization for 1 Bedroom home.', baseCost: 12, avgLabor: 2.0, category: 'Maintenance' },
    { name: 'Standard Cleaning - 2BR/1BA', description: 'Dusting, vacuuming, mopping, and basic surface sanitization.', baseCost: 15, avgLabor: 2.5, category: 'Maintenance' },
    { name: 'Standard Cleaning - 2BR/2BA', description: 'Dusting, vacuuming, mopping, and basic surface sanitization.', baseCost: 18, avgLabor: 3.0, category: 'Maintenance' },
    { name: 'Standard Cleaning - 3BR/2BA', description: 'Dusting, vacuuming, mopping, and basic surface sanitization for mid-size home.', baseCost: 20, avgLabor: 3.5, category: 'Maintenance' },
    { name: 'Standard Cleaning - 4BR/3BA', description: 'Dusting, vacuuming, mopping, and basic surface sanitization for large home.', baseCost: 25, avgLabor: 4.5, category: 'Maintenance' },
    { name: 'Standard Cleaning - 5BR/4BA', description: 'Dusting, vacuuming, mopping, and basic surface sanitization for estate home.', baseCost: 35, avgLabor: 6.0, category: 'Maintenance' },
    { name: 'Kitchen Only - Standard Clean', description: 'Countertops, sink, exterior of appliances, floors.', baseCost: 5, avgLabor: 1.0, category: 'Maintenance' },
    { name: 'Bathroom Only - Standard Clean', description: 'Toilet, tub/shower, sink, mirror, floors.', baseCost: 5, avgLabor: 0.75, category: 'Maintenance' },

    // --- 2. DEEP CLEANING & SANITIZATION ---
    { name: 'Deep Clean - Small Home (<1500 sqft)', description: 'Includes baseboards, inside windows, cabinet fronts, and light fixtures.', baseCost: 35, avgLabor: 5.0, category: 'Maintenance' },
    { name: 'Deep Clean - Medium Home (1500-2500 sqft)', description: 'Comprehensive detail cleaning of all reachable surfaces.', baseCost: 55, avgLabor: 8.0, category: 'Maintenance' },
    { name: 'Deep Clean - Large Home (2500-4000 sqft)', description: 'Comprehensive detail cleaning of all reachable surfaces.', baseCost: 75, avgLabor: 12.0, category: 'Maintenance' },
    { name: 'Kitchen Deep Clean', description: 'Scrubbing grout, degreasing backsplash, inside microwave, cabinet fronts.', baseCost: 15, avgLabor: 2.5, category: 'Maintenance' },
    { name: 'Bathroom Deep Clean', description: 'Descaling shower glass, scrubbing grout, detailed fixture polishing.', baseCost: 12, avgLabor: 2.0, category: 'Maintenance' },
    { name: 'Bio-Hazard / Sanitization Level 1', description: 'High-level disinfection of common touch points using hospital-grade chemicals.', baseCost: 85, avgLabor: 2.0, category: 'Diagnostics' },
    { name: 'Bio-Hazard Cleanup - Level 2', description: 'Cleanup of bodily fluids, animal waste, or severe hoarding (Hazmat suit required).', baseCost: 250, avgLabor: 4.0, category: 'Diagnostics' },
    { name: 'Steam Sanitization - Hard Floors', description: 'High-temperature steam cleaning for tile and grout sanitization.', baseCost: 15, avgLabor: 1.5, category: 'Maintenance' },
    { name: 'Ozone Treatment (Odor Removal)', description: 'Set up commercial ozone generator to neutralize odors (24hr rental).', baseCost: 45, avgLabor: 1.0, category: 'Cleaning' },

    // --- 3. MOVE-IN / MOVE-OUT SPECIALIST ---
    { name: 'Move-Out Clean - Studio/1BA', description: 'Full strip cleaning including inside cabinets and appliances.', baseCost: 45, avgLabor: 4.0, category: 'Cleaning' },
    { name: 'Move-Out Clean - 2BR/2BA', description: 'Full strip cleaning including inside cabinets and appliances.', baseCost: 65, avgLabor: 6.0, category: 'Cleaning' },
    { name: 'Move-Out Clean - 3BR/2BA', description: 'Full strip cleaning including inside cabinets and appliances.', baseCost: 85, avgLabor: 8.0, category: 'Cleaning' },
    { name: 'Move-Out Clean - 4BR+', description: 'Full strip cleaning including inside cabinets and appliances.', baseCost: 110, avgLabor: 10.0, category: 'Cleaning' },
    { name: 'Move-In Clean - Sanitize & Prep', description: 'Full sanitization and preparation for new occupancy (assuming empty).', baseCost: 65, avgLabor: 6.0, category: 'Cleaning' },
    { name: 'Inside Cabinet/Drawer Detail', description: 'Vacuuming and wiping down interiors of all kitchen and bathroom cabinetry.', baseCost: 5, avgLabor: 1.5, category: 'Cleaning' },
    { name: 'Wall Washing - Per Room', description: 'Gentle cleaning of painted walls to remove scuffs and dust.', baseCost: 8, avgLabor: 1.5, category: 'Cleaning' },

    // --- 4. COMMERCIAL & OFFICE ---
    { name: 'Commercial Office Clean - Small (<1000 sqft)', description: 'Trash removal, vacuuming, and workstation sanitization.', baseCost: 15, avgLabor: 1.5, category: 'Cleaning' },
    { name: 'Commercial Office Clean - Medium (1000-3000 sqft)', description: 'Trash removal, vacuuming, and workstation sanitization.', baseCost: 25, avgLabor: 3.0, category: 'Cleaning' },
    { name: 'Breakroom / Kitchenette Deep Clean', description: 'Commercial grade degreasing and sanitization of shared food areas.', baseCost: 35, avgLabor: 2.0, category: 'Cleaning' },
    { name: 'Restroom Sanitization - Commercial (Per Stall)', description: 'Full disinfection of sinks, toilets, and floors.', baseCost: 10, avgLabor: 0.5, category: 'Cleaning' },
    { name: 'Floor Buffing / Polishing (Per 500 sqft)', description: 'Machine buffing of VCT or stone floors to restore shine.', baseCost: 45, avgLabor: 2.0, category: 'Cleaning' },
    { name: 'Floor Strip and Wax (Per Sqft)', description: 'Complete removal of old wax and application of 3 coats of high-gloss finish.', baseCost: 0.35, avgLabor: 0.05, category: 'Cleaning' },

    // --- 5. CARPET & UPHOLSTERY ---
    { name: 'Carpet Steam Cleaning - Per Room', description: 'Hot water extraction for standard sized rooms up to 200 sqft.', baseCost: 8, avgLabor: 0.75, category: 'Maintenance' },
    { name: 'Carpet Steam Cleaning - Hallway/Stairs', description: 'Traffic lane cleaning for stairs and halls.', baseCost: 5, avgLabor: 0.5, category: 'Maintenance' },
    { name: 'Carpet Spot Treatment - Pet Stain/Odor', description: 'Enzymatic treatment for targeted organic stains.', baseCost: 25, avgLabor: 0.5, category: 'Maintenance' },
    { name: 'Upholstery Clean - Standard Sofa', description: 'Steam or dry clean of 3-seater sofa.', baseCost: 12, avgLabor: 1.25, category: 'Maintenance' },
    { name: 'Upholstery Clean - Sectional Sofa', description: 'Steam or dry clean of L-shaped sectional.', baseCost: 18, avgLabor: 2.0, category: 'Maintenance' },
    { name: 'Upholstery Clean - Recliner / Chair', description: 'Steam or dry clean of single upholstered chair.', baseCost: 8, avgLabor: 0.75, category: 'Maintenance' },
    { name: 'Area Rug Cleaning - Synthetic (Per sqft)', description: 'In-home low-moisture cleaning for area rugs.', baseCost: 0.50, avgLabor: 0.02, category: 'Maintenance' },
    { name: 'Area Rug Cleaning - Wool/Delicate (Per sqft)', description: 'Specialized cleaning for delicate fibers.', baseCost: 1.00, avgLabor: 0.04, category: 'Maintenance' },

    // --- 6. WINDOWS & EXTERIOR ---
    { name: 'Window Cleaning - Interior (Per Pane)', description: 'Squeegee clean and track wipe.', baseCost: 0.50, avgLabor: 0.1, category: 'Cleaning' },
    { name: 'Window Cleaning - Exterior (Per Pane)', description: 'Reach cleaning for standard residential panes (Ground Level).', baseCost: 0.75, avgLabor: 0.15, category: 'Cleaning' },
    { name: 'Window Cleaning - Exterior (2nd Story Per Pane)', description: 'Ladder work for second story windows.', baseCost: 1.50, avgLabor: 0.25, category: 'Cleaning' },
    { name: 'Screen Cleaning - Per Screen', description: 'Hand wash and dry of window screens.', baseCost: 0.50, avgLabor: 0.05, category: 'Cleaning' },
    { name: 'Sliding Glass Door Detail', description: 'Track vacuuming, lubrication, and glass cleaning (In/Out).', baseCost: 4, avgLabor: 0.5, category: 'Cleaning' },
    { name: 'Skylight Cleaning (Interior)', description: 'Cleaning of high-access skylight glass.', baseCost: 5, avgLabor: 0.5, category: 'Cleaning' },

    // --- 7. SPECIALIZED ADD-ONS ---
    { name: 'Inside Oven Deep Clean', description: 'Degreasing and scrubbing of oven interior and racks.', baseCost: 12, avgLabor: 1.0, category: 'Maintenance' },
    { name: 'Inside Refrigerator Detail', description: 'Emptying, cleaning, and sanitizing all shelves and drawers.', baseCost: 8, avgLabor: 0.75, category: 'Maintenance' },
    { name: 'Dishwasher Interior Cleaning', description: 'Cleaning filters and descaling cycle.', baseCost: 6, avgLabor: 0.5, category: 'Maintenance' },
    { name: 'Laundry Service - Wash & Fold (Per Load)', description: 'Standard machine wash, dry, and professional fold.', baseCost: 4, avgLabor: 1.0, category: 'Maintenance' },
    { name: 'Blinds / Shutters Hand Wipe (Per Window)', description: 'Detailed dusting of individual slats.', baseCost: 2, avgLabor: 0.4, category: 'Maintenance' },
    { name: 'Baseboard Detail (Wet Wipe)', description: 'Hand scrubbing of baseboards throughout home.', baseCost: 5, avgLabor: 1.5, category: 'Maintenance' },
    { name: 'Ceiling Fan Blade Cleaning', description: 'Dusting and wiping of fan blades.', baseCost: 1, avgLabor: 0.2, category: 'Maintenance' },

    // --- 8. POST-CONSTRUCTION CLEANING ---
    { name: 'Post-Construction Rough Clean (Per Sqft)', description: 'Removal of debris and heavy dust after framing/drywall.', baseCost: 0.10, avgLabor: 0.02, category: 'Cleaning' },
    { name: 'Post-Construction Final Shine (Per Sqft)', description: 'Detailed removal of paint overspray, dust, and stickers.', baseCost: 0.15, avgLabor: 0.04, category: 'Cleaning' },
    { name: 'Paint Overspray Removal (Per Hour)', description: 'Scraping and solvent removal of dried paint spots.', baseCost: 10, avgLabor: 1.0, category: 'Cleaning' },
];
