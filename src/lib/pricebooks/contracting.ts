
import { ProposalPreset } from '@types';

export const CONTRACTING_MASTER_BOOK: Omit<ProposalPreset, 'id' | 'organizationId'>[] = [
    // --- 1. SITE PREP, DEMOLITION & PROTECTION ---
    { name: 'Site Protection - Floor (Ram Board/Paper)', description: 'Supply and install heavy duty floor protection per room.', baseCost: 45, avgLabor: 1.0, category: 'Contracting' },
    { name: 'Dust Barrier - Zip Wall', description: 'Install plastic dust containment wall with zipper entry.', baseCost: 35, avgLabor: 0.75, category: 'Contracting' },
    { name: 'Demo - Carpet & Pad (Per Sqft)', description: 'Remove and dispose of carpet and padding (tack strip removal included).', baseCost: 0.15, avgLabor: 0.03, category: 'Contracting' },
    { name: 'Demo - Tile/Stone Flooring (Per Sqft)', description: 'Chipping hammer removal of bonded tile and thinset.', baseCost: 0.25, avgLabor: 0.15, category: 'Contracting' },
    { name: 'Demo - Hardwood Flooring (Per Sqft)', description: 'Removal of nailed or glued hardwood flooring.', baseCost: 0.20, avgLabor: 0.12, category: 'Contracting' },
    { name: 'Demo - Drywall (Per Sqft)', description: 'Remove sheetrock and insulation down to studs.', baseCost: 0.10, avgLabor: 0.05, category: 'Contracting' },
    { name: 'Demo - Kitchen Cabinets (Per Box)', description: 'Careful removal of cabinet box (Base or Wall).', baseCost: 0, avgLabor: 0.5, category: 'Contracting' },
    { name: 'Demo - Countertop (Per LF)', description: 'Remove laminate or stone countertop.', baseCost: 5, avgLabor: 0.5, category: 'Contracting' },
    { name: 'Dumpster Rental - 20 Yard', description: 'Rental and tipping fees for construction debris.', baseCost: 550, avgLabor: 0.5, category: 'Other' },
    { name: 'Debris Haul Away - Pickup Truck Load', description: 'Load and haul debris (approx 1 ton).', baseCost: 65, avgLabor: 2.0, category: 'Other' },

    // --- 2. FRAMING & ROUGH CARPENTRY ---
    { name: 'Wall Framing - 2x4 Non-Load Bearing (Per LF)', description: 'Construct interior partition wall (16" OC).', baseCost: 12, avgLabor: 0.5, category: 'Contracting' },
    { name: 'Wall Framing - 2x6 Wet Wall (Per LF)', description: 'Construct plumbing wall with larger cavity.', baseCost: 16, avgLabor: 0.6, category: 'Contracting' },
    { name: 'Furring Strip Installation (Per LF)', description: 'Install 1x2 or 1x3 furring strips on masonry.', baseCost: 3, avgLabor: 0.25, category: 'Contracting' },
    { name: 'Soffit / Bulkhead Framing (Per LF)', description: 'Frame drop-down soffit for HVAC or plumbing concealment.', baseCost: 15, avgLabor: 0.75, category: 'Contracting' },
    { name: 'Door Rough Opening Framing', description: 'Frame header, king studs, and jacks for standard door.', baseCost: 45, avgLabor: 2.0, category: 'Contracting' },
    { name: 'Window Rough Opening Framing', description: 'Frame header and sill for standard window.', baseCost: 55, avgLabor: 2.5, category: 'Contracting' },
    { name: 'Blocking / Backing Install', description: 'Install wood blocking for cabinets, towel bars, or TV mounts.', baseCost: 8, avgLabor: 0.5, category: 'Contracting' },
    { name: 'Subfloor Repair - 3/4" Plywood (Per Sheet)', description: 'Cut out damaged subfloor and replace with new sheathing.', baseCost: 65, avgLabor: 2.0, category: 'Contracting' },

    // --- 3. DRYWALL & FINISHING ---
    { name: 'Drywall Hang - 1/2" Standard (Per 4x8 Sheet)', description: 'Install sheetrock with screws (Labor & Material).', baseCost: 18, avgLabor: 1.0, category: 'Contracting' },
    { name: 'Drywall Hang - 5/8" Firecode (Per 4x8 Sheet)', description: 'Install fire-rated drywall.', baseCost: 24, avgLabor: 1.25, category: 'Contracting' },
    { name: 'Drywall Hang - Moisture Resistant (Per Sheet)', description: 'Install green/purple board in wet areas.', baseCost: 26, avgLabor: 1.0, category: 'Contracting' },
    { name: 'Drywall Finish - Level 3 (Per Sqft)', description: 'Tape and block coat (Texture ready).', baseCost: 0.15, avgLabor: 0.05, category: 'Contracting' },
    { name: 'Drywall Finish - Level 4 (Per Sqft)', description: 'Tape, block, and skim coat (Smooth paint ready).', baseCost: 0.25, avgLabor: 0.1, category: 'Contracting' },
    { name: 'Texture Application - Knockdown (Per Sqft)', description: 'Spray and trowel knockdown texture.', baseCost: 0.10, avgLabor: 0.04, category: 'Contracting' },
    { name: 'Texture Application - Orange Peel (Per Sqft)', description: 'Spray standard orange peel texture.', baseCost: 0.08, avgLabor: 0.03, category: 'Contracting' },
    { name: 'Drywall Patch - Small (< 1 Sqft)', description: 'Repair doorknob hole or small damage. Includes texture match.', baseCost: 15, avgLabor: 1.5, category: 'Contracting' },
    { name: 'Drywall Patch - Medium (2x2)', description: 'Cut back studs, patch, tape, and finish.', baseCost: 25, avgLabor: 2.5, category: 'Contracting' },
    { name: 'Corner Bead Installation (Per 8ft)', description: 'Install metal or vinyl outside corner bead.', baseCost: 6, avgLabor: 0.5, category: 'Contracting' },

    // --- 4. INSULATION ---
    { name: 'Insulation - Fiberglass Batts R-13 (Per Sqft)', description: 'Install faced batts in 2x4 walls.', baseCost: 0.65, avgLabor: 0.03, category: 'Contracting' },
    { name: 'Insulation - Fiberglass Batts R-19 (Per Sqft)', description: 'Install faced batts in 2x6 walls or floors.', baseCost: 0.95, avgLabor: 0.04, category: 'Contracting' },
    { name: 'Insulation - Rockwool Safe\'n\'Sound (Per Sqft)', description: 'Install sound dampening insulation.', baseCost: 1.25, avgLabor: 0.05, category: 'Contracting' },
    { name: 'Insulation - Blown-In Attic (Per Sqft)', description: 'Add R-30 equivalent blown fiberglass or cellulose.', baseCost: 0.85, avgLabor: 0.02, category: 'Contracting' },

    // --- 5. FLOORING ---
    { name: 'LVP Flooring Installation (Per Sqft)', description: 'Install click-lock Luxury Vinyl Plank (Labor Only).', baseCost: 0.25, avgLabor: 0.1, category: 'Contracting' },
    { name: 'Laminate Flooring Installation (Per Sqft)', description: 'Install laminate with underlayment (Labor Only).', baseCost: 0.35, avgLabor: 0.12, category: 'Contracting' },
    { name: 'Hardwood - Nail Down (Per Sqft)', description: 'Install solid or engineered wood flooring.', baseCost: 0.75, avgLabor: 0.2, category: 'Contracting' },
    { name: 'Hardwood - Glue Down (Per Sqft)', description: 'Install engineered wood on slab with adhesive.', baseCost: 1.50, avgLabor: 0.25, category: 'Contracting' },
    { name: 'Tile Floor Install (Per Sqft)', description: 'Install ceramic/porcelain floor tile on prepared subfloor.', baseCost: 2.50, avgLabor: 0.35, category: 'Contracting' },
    { name: 'Tile Backer Board Install (Per Sqft)', description: 'Install HardieBacker or Ditra matting.', baseCost: 1.85, avgLabor: 0.15, category: 'Contracting' },
    { name: 'Shoe Mold / Quarter Round Install (Per LF)', description: 'Install prepainted shoe molding at baseboard.', baseCost: 1.50, avgLabor: 0.1, category: 'Contracting' },
    { name: 'Transition Strip Installation', description: 'Install T-molding or reducer at doorway.', baseCost: 25, avgLabor: 0.5, category: 'Contracting' },

    // --- 6. TILE (WALLS & SHOWERS) ---
    { name: 'Tile Shower Walls (Per Sqft)', description: 'Install wall tile (Subway or 12x24).', baseCost: 2.00, avgLabor: 0.45, category: 'Contracting' },
    { name: 'Shower Pan Installation (Hot Mop/Liner)', description: 'Build custom mortar bed and waterproof liner.', baseCost: 150, avgLabor: 8.0, category: 'Contracting' },
    { name: 'Shower Niche Installation', description: 'Frame and tile recessed shampoo niche.', baseCost: 120, avgLabor: 4.0, category: 'Contracting' },
    { name: 'Kitchen Backsplash Install (Per Sqft)', description: 'Install mosaic or subway tile backsplash.', baseCost: 3.00, avgLabor: 0.4, category: 'Contracting' },
    { name: 'Grouting (Per Sqft)', description: 'Apply sanded or unsanded grout.', baseCost: 0.50, avgLabor: 0.1, category: 'Contracting' },

    // --- 7. TRIM & MILLWORK ---
    { name: 'Baseboard Install - Standard 3-4" (Per LF)', description: 'Cut and install MDF or Pine baseboard.', baseCost: 2.50, avgLabor: 0.15, category: 'Contracting' },
    { name: 'Baseboard Install - Tall 5"+ (Per LF)', description: 'Install tall architectural baseboard.', baseCost: 4.00, avgLabor: 0.2, category: 'Contracting' },
    { name: 'Crown Molding Install (Per LF)', description: 'Install decorative crown molding (Paint grade).', baseCost: 4.50, avgLabor: 0.35, category: 'Contracting' },
    { name: 'Window Casing / Trim (Per Window)', description: 'Picture frame window trim installation.', baseCost: 25, avgLabor: 1.5, category: 'Contracting' },
    { name: 'Door Casing - Both Sides (Per Door)', description: 'Install trim around door frame.', baseCost: 35, avgLabor: 1.0, category: 'Contracting' },
    { name: 'Wainscoting / Shiplap Install (Per Sqft)', description: 'Install wall paneling or tongue and groove.', baseCost: 4.00, avgLabor: 0.25, category: 'Contracting' },
    { name: 'Shelving - Wire (Per LF)', description: 'Install ClosetMaid style wire shelving.', baseCost: 8, avgLabor: 0.3, category: 'Contracting' },
    { name: 'Shelving - Wood/Melamine (Per LF)', description: 'Install solid wood or melamine shelf with brackets.', baseCost: 15, avgLabor: 0.6, category: 'Contracting' },

    // --- 8. DOORS & WINDOWS ---
    { name: 'Interior Door - Pre-Hung (Hollow Core)', description: 'Install standard bedroom/bathroom door unit.', baseCost: 85, avgLabor: 2.0, category: 'Contracting' },
    { name: 'Interior Door - Pre-Hung (Solid Core)', description: 'Install heavy solid core door unit.', baseCost: 180, avgLabor: 2.5, category: 'Contracting' },
    { name: 'Interior Door - Slab Only', description: 'Mortise hinges and bore lockset for new slab.', baseCost: 65, avgLabor: 2.0, category: 'Contracting' },
    { name: 'Exterior Entry Door (Pre-Hung)', description: 'Install new front or back door with weatherstripping.', baseCost: 350, avgLabor: 4.0, category: 'Contracting' },
    { name: 'Storm Door Installation', description: 'Install aluminum storm door.', baseCost: 180, avgLabor: 2.0, category: 'Contracting' },
    { name: 'Sliding Patio Door Install (Standard 6ft)', description: 'Remove old and install new vinyl slider.', baseCost: 850, avgLabor: 6.0, category: 'Contracting' },
    { name: 'Window Replacement - Insert/Retrofit', description: 'Install vinyl replacement window in existing frame.', baseCost: 220, avgLabor: 2.0, category: 'Contracting' },
    { name: 'Window Replacement - New Construction', description: 'Remove siding, flash, and install window with nail fin.', baseCost: 280, avgLabor: 4.0, category: 'Contracting' },
    { name: 'Lockset / Deadbolt Install', description: 'Install door hardware.', baseCost: 0, avgLabor: 0.5, category: 'Contracting' },

    // --- 9. CABINETS & COUNTERTOPS ---
    { name: 'Cabinet Install - Base Unit', description: 'Level and secure base cabinet box.', baseCost: 5, avgLabor: 1.5, category: 'Contracting' },
    { name: 'Cabinet Install - Wall Unit', description: 'Secure wall cabinet to studs.', baseCost: 5, avgLabor: 1.5, category: 'Contracting' },
    { name: 'Cabinet Install - Tall/Pantry', description: 'Install floor-to-ceiling cabinet.', baseCost: 10, avgLabor: 2.5, category: 'Contracting' },
    { name: 'Cabinet Filler / Scribe Install', description: 'Cut and install filler strip.', baseCost: 0, avgLabor: 0.75, category: 'Contracting' },
    { name: 'Cabinet Hardware Install (Per Handle)', description: 'Drill and mount knob or pull.', baseCost: 0, avgLabor: 0.2, category: 'Contracting' },
    { name: 'Countertop - Laminate (Per LF)', description: 'Install pre-fab laminate top.', baseCost: 25, avgLabor: 1.0, category: 'Contracting' },
    { name: 'Butcher Block Countertop Install', description: 'Cut, finish, and install wood countertop.', baseCost: 65, avgLabor: 3.0, category: 'Contracting' },

    // --- 10. DECKS & EXTERIOR CARPENTRY ---
    { name: 'Deck Board Replacement (Per LF)', description: 'Remove and replace pressure treated decking.', baseCost: 3.50, avgLabor: 0.25, category: 'Contracting' },
    { name: 'Deck Railing Repair (Per Section)', description: 'Re-secure or replace handrail section.', baseCost: 25, avgLabor: 2.0, category: 'Contracting' },
    { name: 'Fence Picket Replacement (Per Picket)', description: 'Replace broken dog-ear picket.', baseCost: 3.50, avgLabor: 0.15, category: 'Contracting' },
    { name: 'Fence Post Replacement (4x4)', description: 'Dig out footing and set new post in concrete.', baseCost: 45, avgLabor: 3.0, category: 'Contracting' },
    { name: 'Fascia Board Replacement (Per LF)', description: 'Replace rotted sub-fascia or fascia board.', baseCost: 6, avgLabor: 1.0, category: 'Contracting' },
    { name: 'Siding Repair - Vinyl (Per Sqft)', description: 'Patch or replace damaged vinyl siding.', baseCost: 4, avgLabor: 0.5, category: 'Contracting' },
    { name: 'Siding Repair - Hardie/Cement (Per Sqft)', description: 'Replace fiber cement plank.', baseCost: 6, avgLabor: 0.6, category: 'Contracting' },

    // --- 11. GENERAL REPAIRS ---
    { name: 'Handyman Labor (Hourly)', description: 'General repair labor for unspecified tasks.', baseCost: 0, avgLabor: 1.0, category: 'Other' },
    { name: 'Access Panel Installation', description: 'Cut drywall and install plastic access door.', baseCost: 25, avgLabor: 1.0, category: 'Contracting' },
    { name: 'TV Wall Mount - Standard', description: 'Mount TV bracket to studs.', baseCost: 15, avgLabor: 1.0, category: 'Accessories' },
    { name: 'Picture / Mirror Hanging (Heavy)', description: 'Secure mounting for items > 20lbs.', baseCost: 5, avgLabor: 0.5, category: 'Accessories' },
    { name: 'Furniture Assembly (Per Hour)', description: 'Assembly of flat-pack furniture.', baseCost: 0, avgLabor: 1.0, category: 'Other' }
];
