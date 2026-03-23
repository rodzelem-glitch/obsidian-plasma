import { ProposalPreset } from 'types';

export const CLEANING_MASTER_BOOK: Omit<ProposalPreset, 'id' | 'organizationId'>[] = [
    // 1. STANDARD RESIDENTIAL CLEANING
    { name: 'Standard Cleaning - 1BR/1BA', description: 'Dusting, vacuuming, mopping, and basic surface sanitization for 1 Bedroom apartment.', baseCost: 15, avgLabor: 2, category: 'Maintenance' },
    { name: 'Standard Cleaning - 2BR/1BA', description: 'Dusting, vacuuming, mopping, and basic surface sanitization.', baseCost: 20, avgLabor: 3, category: 'Maintenance' },
    { name: 'Standard Cleaning - 3BR/2BA', description: 'Dusting, vacuuming, mopping, and basic surface sanitization for mid-size home.', baseCost: 25, avgLabor: 4, category: 'Maintenance' },
    { name: 'Standard Cleaning - 4BR/3BA', description: 'Dusting, vacuuming, mopping, and basic surface sanitization for large home.', baseCost: 35, avgLabor: 5.5, category: 'Maintenance' },
    { name: 'Recurring Service - Bi-Weekly Discount', description: 'Discount applied to recurring bi-weekly standard maintenance cleaning.', baseCost: 0, avgLabor: 0, category: 'Other' },
    { name: 'Recurring Service - Weekly Discount', description: 'Discount applied to recurring weekly standard maintenance cleaning.', baseCost: 0, avgLabor: 0, category: 'Other' },

    // 2. DEEP CLEANING & SANITIZATION
    { name: 'Deep Clean - Small Home (<1500 sqft)', description: 'Includes baseboards, inside windows, cabinet fronts, and light fixtures.', baseCost: 45, avgLabor: 6, category: 'Maintenance' },
    { name: 'Deep Clean - Medium Home (1500-2500 sqft)', description: 'Comprehensive detail cleaning of all reachable surfaces.', baseCost: 65, avgLabor: 9, category: 'Maintenance' },
    { name: 'Deep Clean - Large Home (2500-4000 sqft)', description: 'Comprehensive detail cleaning of all reachable surfaces.', baseCost: 95, avgLabor: 14, category: 'Maintenance' },
    { name: 'Bio-Hazard / Sanitization Level 1', description: 'High-level disinfection of common touch points using hospital-grade chemicals.', baseCost: 85, avgLabor: 2, category: 'Diagnostics' },
    { name: 'Steam Sanitization - Hard Floors', description: 'High-temperature steam cleaning for tile and grout sanitization.', baseCost: 15, avgLabor: 1.5, category: 'Maintenance' },

    // 3. MOVE-IN / MOVE-OUT SPECIALIST
    { name: 'Move-Out Clean - Full Home Empty', description: 'Deep clean including inside all cabinets, drawers, closets, and appliances.', baseCost: 85, avgLabor: 8, category: 'Cleaning' },
    { name: 'Move-In Clean - Sanitize & Prep', description: 'Full sanitization and preparation for new occupancy.', baseCost: 75, avgLabor: 7, category: 'Cleaning' },
    { name: 'Inside Cabinet/Drawer Detail', description: 'Vacuuming and wiping down interiors of all kitchen and bathroom cabinetry.', baseCost: 5, avgLabor: 2, category: 'Cleaning' },
    { name: 'Wall Washing - Per Room', description: 'Gentle cleaning of painted walls to remove scuffs and dust.', baseCost: 8, avgLabor: 1.5, category: 'Cleaning' },

    // 4. COMMERCIAL & OFFICE
    { name: 'Commercial Office Clean - Per 1000 sqft', description: 'Trash removal, vacuuming, and workstation sanitization.', baseCost: 25, avgLabor: 1.5, category: 'Cleaning' },
    { name: 'Breakroom / Kitchenette Deep Clean', description: 'Commercial grade degreasing and sanitization of shared food areas.', baseCost: 45, avgLabor: 2, category: 'Cleaning' },
    { name: 'Restroom Sanitization - Commercial (Per Stall)', description: 'Full disinfection of sinks, toilets, and floors.', baseCost: 15, avgLabor: 0.75, category: 'Cleaning' },
    { name: 'Floor Buffing / Polishing (Per 500 sqft)', description: 'Machine buffing of VCT or stone floors to restore shine.', baseCost: 55, avgLabor: 2.5, category: 'Cleaning' },

    // 5. CARPET & UPHOLSTERY
    { name: 'Carpet Steam Cleaning - Per Room', description: 'Hot water extraction for standard sized rooms up to 200 sqft.', baseCost: 12, avgLabor: 1, category: 'Maintenance' },
    { name: 'Carpet Spot Treatment - Pet Stain/Odor', description: 'Enzymatic treatment for targeted organic stains.', baseCost: 35, avgLabor: 0.5, category: 'Maintenance' },
    { name: 'Upholstery Clean - Standard Sofa', description: 'Steam or dry clean of 3-seater sofa.', baseCost: 15, avgLabor: 1.5, category: 'Maintenance' },
    { name: 'Upholstery Clean - Recliner / Chair', description: 'Steam or dry clean of single upholstered chair.', baseCost: 8, avgLabor: 0.75, category: 'Maintenance' },
    { name: 'Area Rug Cleaning - Synthetic (Per sqft)', description: 'In-home low-moisture cleaning for area rugs.', baseCost: 2, avgLabor: 0.05, category: 'Maintenance' },

    // 6. WINDOWS & EXTERIOR
    { name: 'Window Cleaning - Interior (Per Pane)', description: 'Squeegee clean and track wipe.', baseCost: 1, avgLabor: 0.1, category: 'Cleaning' },
    { name: 'Window Cleaning - Exterior (Per Pane)', description: 'Reach cleaning for standard residential panes.', baseCost: 1.5, avgLabor: 0.15, category: 'Cleaning' },
    { name: 'Screen Cleaning - Per Screen', description: 'Hand wash and dry of window screens.', baseCost: 0.5, avgLabor: 0.05, category: 'Cleaning' },
    { name: 'Sliding Glass Door Detail', description: 'Track vacuuming, lubrication, and glass cleaning.', baseCost: 5, avgLabor: 0.5, category: 'Cleaning' },

    // 7. SPECIALIZED ADD-ONS
    { name: 'Inside Oven Deep Clean', description: 'Degreasing and scrubbing of oven interior and racks.', baseCost: 15, avgLabor: 1.5, category: 'Maintenance' },
    { name: 'Inside Refrigerator Detail', description: 'Emptying, cleaning, and sanitizing all shelves and drawers.', baseCost: 10, avgLabor: 1, category: 'Maintenance' },
    { name: 'Dishwasher Interior Cleaning', description: 'Cleaning filters and descaling cycle.', baseCost: 8, avgLabor: 0.5, category: 'Maintenance' },
    { name: 'Laundry Service - Wash & Fold (Per Load)', description: 'Standard machine wash, dry, and professional fold.', baseCost: 5, avgLabor: 1.25, category: 'Maintenance' },
    { name: 'Blinds / Shutters Hand Wipe (Per Window)', description: 'Detailed dusting of individual slats.', baseCost: 2, avgLabor: 0.5, category: 'Maintenance' },

    // 8. POST-CONSTRUCTION CLEANING
    { name: 'Post-Construction Rough Clean', description: 'Removal of debris and heavy dust after framing/drywall.', baseCost: 45, avgLabor: 4, category: 'Cleaning' },
    { name: 'Post-Construction Final Shine', description: 'Detailed removal of paint overspray, dust, and stickers.', baseCost: 65, avgLabor: 6, category: 'Cleaning' },
];
