import { ProposalPreset } from 'types';

export const CONTRACTING_MASTER_BOOK: Omit<ProposalPreset, 'id' | 'organizationId'>[] = [
    // 1. DEMOLITION & WASTE
    { name: 'Interior Demo - Carpet/Pad (Per Sqft)', description: 'Remove and bundle existing soft flooring.', baseCost: 0.05, avgLabor: 0.02, category: 'Contracting' },
    { name: 'Interior Demo - Hardwood/Tile (Per Sqft)', description: 'Chipping and removal of bonded flooring.', baseCost: 0.15, avgLabor: 0.08, category: 'Contracting' },
    { name: 'Interior Demo - Drywall Wall (Per Sqft)', description: 'Remove sheetrock and fasteners (Non-load bearing).', baseCost: 0.05, avgLabor: 0.05, category: 'Contracting' },
    { name: 'Kitchen Demo - Full Strip', description: 'Remove all cabinets, counters, and backsplash.', baseCost: 50, avgLabor: 8, category: 'Contracting' },
    { name: 'Waste Disposal Fee - Per Dumpster', description: 'Standard 20-yard roll-off dumpster rental and tipping fees.', baseCost: 550, avgLabor: 0.5, category: 'Other' },
    { name: 'Jobsite Protection Package', description: 'Ram-board floors, zip-walls for dust, and HEPA scrubbing.', baseCost: 150, avgLabor: 3, category: 'Other' },

    // 2. FRAMING & ROUGH-IN
    { name: 'Wall Framing - Wood (Per LF)', description: 'Standard 2x4 interior partition framing @ 16" OC.', baseCost: 8, avgLabor: 0.4, category: 'Contracting' },
    { name: 'Blocking / Backing Installation', description: 'Install internal wood blocking for TVs, cabinets, or bars.', baseCost: 15, avgLabor: 1, category: 'Contracting' },
    { name: 'Header Installation - Standard Door', description: 'Structure rough opening for new interior door.', baseCost: 25, avgLabor: 2, category: 'Contracting' },
    { name: 'Sill Plate Repair / Replacement', description: 'Specialized structural repair of rotted sill plates.', baseCost: 45, avgLabor: 4, category: 'Contracting' },

    // 3. DRYWALL & FINISHING
    { name: 'Drywall Install - Per Sheet (4x8)', description: 'Hang, tape, and bed to Level 4 finish (Excludes Paint).', baseCost: 32, avgLabor: 3, category: 'Contracting' },
    { name: 'Corner Bead Installation - Per 8ft', description: 'Install and mud metal or plastic outside corners.', baseCost: 8, avgLabor: 0.75, category: 'Contracting' },
    { name: 'Ceiling Patch - Texture Match', description: 'Skilled repair to match popcorn, knockdown, or orange peel.', baseCost: 15, avgLabor: 3, category: 'Contracting' },
    { name: 'Skim Coat - Per Room', description: 'Full surface mud application to smooth out textured walls.', baseCost: 45, avgLabor: 6, category: 'Contracting' },

    // 4. FLOORING INSTALLATION
    { name: 'LVP / Laminate Installation (Per Sqft)', description: 'Floating floor install (Includes underlayment).', baseCost: 0.2, avgLabor: 0.08, category: 'Contracting' },
    { name: 'Hardwood Installation - Nail Down', description: 'Solid or engineered wood installation (Per Sqft).', baseCost: 1.5, avgLabor: 0.15, category: 'Contracting' },
    { name: 'Tile Installation - Standard Floor', description: 'Setting, grouting, and sealing ceramic/porcelain (Per Sqft).', baseCost: 2.5, avgLabor: 0.25, category: 'Contracting' },
    { name: 'Floor Leveling / Self-Leveling Pour', description: 'Correcting subfloor variances prior to install.', baseCost: 45, avgLabor: 2, category: 'Contracting' },

    // 5. TRIM & MILLWORK
    { name: 'Baseboard Installation (Per LF)', description: 'Install and nail standard MDF or wood base.', baseCost: 1.2, avgLabor: 0.08, category: 'Contracting' },
    { name: 'Crown Molding - Single Stage', description: 'Install standard decorative ceiling molding.', baseCost: 2.5, avgLabor: 0.15, category: 'Contracting' },
    { name: 'Shoe Mold / Quarter Round (Per LF)', description: 'Finish floor transition trim install.', baseCost: 0.8, avgLabor: 0.05, category: 'Contracting' },
    { name: 'Custom Shelving - Closet Kit', description: 'Build and install wood or wire closet storage.', baseCost: 85, avgLabor: 3, category: 'Contracting' },

    // 6. CABINETRY & COUNTERS
    { name: 'Cabinet Install - Base / Wall Unit', description: 'Level and mount single pre-built cabinet box.', baseCost: 0, avgLabor: 1.5, category: 'Contracting' },
    { name: 'Cabinet Hardware Installation (Per Pull)', description: 'Drill and mount handle or knob.', baseCost: 2, avgLabor: 0.2, category: 'Contracting' },
    { name: 'Countertop Template Service', description: 'Detailed measurements for stone/quartz fabrication.', baseCost: 0, avgLabor: 1.5, category: 'Diagnostics' },
    { name: 'Backsplash Tile - Per Sqft', description: 'Setting and grouting kitchen wall tile.', baseCost: 3, avgLabor: 0.35, category: 'Contracting' },

    // 7. WINDOWS & DOORS
    { name: 'Interior Door - Pre-Hung Install', description: 'Set, level, and trim standard interior door.', baseCost: 15, avgLabor: 2, category: 'Contracting' },
    { name: 'Exterior Entry Door - Installation', description: 'Remove and replace main door including weatherstripping.', baseCost: 45, avgLabor: 4, category: 'Contracting' },
    { name: 'Window Replacement - Insert Style', description: 'Install new vinyl replacement window in existing frame.', baseCost: 25, avgLabor: 2, category: 'Contracting' },
    { name: 'Door Hardware / Deadbolt Install', description: 'Drill or swap standard locksets.', baseCost: 0, avgLabor: 0.75, category: 'Contracting' },

    // 8. EXTERIOR STRUCTURES
    { name: 'Deck Board Replacement - Per 8ft', description: 'Remove and replace single damaged cedar/PT board.', baseCost: 22, avgLabor: 1, category: 'Contracting' },
    { name: 'Deck Joist Reinforcement', description: 'Add structural blocking or sistering to existing framing.', baseCost: 15, avgLabor: 2, category: 'Contracting' },
    { name: 'Handrail Repair / Tightening', description: 'Ensure code compliance and safety of existing rails.', baseCost: 5, avgLabor: 1.5, category: 'Contracting' },
];
