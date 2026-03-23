
import { ProposalPreset } from '@types';

export const MASONRY_MASTER_BOOK: Omit<ProposalPreset, 'id' | 'organizationId'>[] = [
    // --- 1. BRICK & BLOCK REPAIR ---
    { name: 'Brick Replacement - Spot Repair (1-5 Bricks)', description: 'Chisel out damaged units, clean cavity, install matching bricks, and tool joints to match.', baseCost: 35, avgLabor: 2.5, category: 'Masonry' },
    { name: 'Brick Replacement - Spot Repair (6-10 Bricks)', description: 'Chisel out damaged units, clean cavity, install matching bricks, and tool joints to match.', baseCost: 60, avgLabor: 4.0, category: 'Masonry' },
    { name: 'Brick Replacement - Spot Repair (11-20 Bricks)', description: 'Chisel out damaged units, clean cavity, install matching bricks, and tool joints to match.', baseCost: 110, avgLabor: 6.0, category: 'Masonry' },
    { name: 'CMU Block Replacement - Single Unit (8x8x16)', description: 'Remove damaged concrete block, prep opening, install new block and mortar.', baseCost: 25, avgLabor: 2.0, category: 'Masonry' },
    { name: 'Window Sill Replacement - Limestone (Per LF)', description: 'Remove damaged sill, prep bed, install new limestone sill with drip edge.', baseCost: 45, avgLabor: 1.5, category: 'Masonry' },
    { name: 'Window Sill Replacement - Rowlock Brick (Per LF)', description: 'Remove damaged rowlock, clean substrate, install new brick angled for drainage.', baseCost: 15, avgLabor: 1.25, category: 'Masonry' },
    { name: 'Steel Lintel Replacement - Window (Up to 4ft)', description: 'Remove brick above opening, replace rusted steel lintel, flash, and re-lay brick.', baseCost: 180, avgLabor: 8.0, category: 'Masonry' },
    { name: 'Steel Lintel Replacement - Garage/Large (Per LF)', description: 'Shoring required. Remove masonry, replace heavy duty angle iron, waterproofing, and relay.', baseCost: 65, avgLabor: 3.5, category: 'Masonry' },
    { name: 'Helical Wall Tie Installation (Per Tie)', description: 'Drill and install stainless steel helical tie to stabilize veneered walls to structure.', baseCost: 22, avgLabor: 0.5, category: 'Masonry' },
    { name: 'Expansion Joint Caulk Replacement (Per LF)', description: 'Cut out old sealant, install backer rod, and apply commercial grade polyurethane sealant.', baseCost: 4, avgLabor: 0.25, category: 'Masonry' },

    // --- 2. TUCKPOINTING & RESTORATION ---
    { name: 'Tuckpointing - Spot Repair (Ground Level)', description: 'Grind out mortar to 3/4" depth and repoint with matching mortar.', baseCost: 5, avgLabor: 1.0, category: 'Masonry' },
    { name: 'Tuckpointing - Wall Area (Per Sqft)', description: 'Comprehensive grinding and repointing of brick wall face (100% repoint).', baseCost: 1.5, avgLabor: 0.25, category: 'Masonry' },
    { name: 'Tuckpointing - Chimney Stack (Per Sqft)', description: 'Grind and repoint chimney brickwork (Requires scaffolding/roof setup).', baseCost: 2.5, avgLabor: 0.4, category: 'Masonry' },
    { name: 'Stone Foundation Repointing (Per Sqft)', description: 'Rake out loose joints in rubble stone foundation and pack with lime mortar.', baseCost: 3.0, avgLabor: 0.5, category: 'Masonry' },
    { name: 'Brick Cleaning - Pressure Wash & Chemical', description: 'Apply masonry detergent, scrub, and pressure wash to remove carbon/dirt.', baseCost: 0.5, avgLabor: 0.1, category: 'Maintenance' },
    { name: 'Paint Removal from Brick (Per Sqft)', description: 'Apply chemical stripper, dwell time, and high pressure rinse to remove paint.', baseCost: 4.0, avgLabor: 0.3, category: 'Masonry' },
    { name: 'Water Repellent Application (Per Sqft)', description: 'Apply siloxane/silane penetrating breathable sealer.', baseCost: 0.65, avgLabor: 0.05, category: 'Maintenance' },
    { name: 'Efflorescence Removal (Per Sqft)', description: 'Chemical treatment and scrubbing to remove white salt deposits.', baseCost: 0.75, avgLabor: 0.15, category: 'Maintenance' },
    { name: 'Graffiti Removal - Masonry Surface', description: 'Specialized solvent application and pressure wash removal.', baseCost: 45, avgLabor: 2.0, category: 'Maintenance' },

    // --- 3. CHIMNEY & FIREPLACE ---
    { name: 'Chimney Crown - Resurface (CrownSeal)', description: 'Apply flexible elastomeric coating over cracked concrete crown.', baseCost: 120, avgLabor: 2.5, category: 'Masonry' },
    { name: 'Chimney Crown - Pour New Concrete (Standard)', description: 'Form and pour new reinforced concrete crown with overhang.', baseCost: 150, avgLabor: 6.0, category: 'Masonry' },
    { name: 'Chimney Crown - Pour New Concrete (Large)', description: 'Form and pour new crown for double flue or large estate chimney.', baseCost: 250, avgLabor: 10.0, category: 'Masonry' },
    { name: 'Chimney Rebuild - Top 5 Courses', description: 'Remove top courses, install new flue tile extension, and relay brick.', baseCost: 180, avgLabor: 12.0, category: 'Masonry' },
    { name: 'Chimney Rebuild - Roof Up (Per LF Height)', description: 'Complete demo and rebuild of chimney stack from roofline up (Standard single flue).', baseCost: 250, avgLabor: 10.0, category: 'Masonry' },
    { name: 'Firebox Repair - Tuckpoint', description: 'Grind and repoint firebrick inside firebox with high-heat mortar.', baseCost: 25, avgLabor: 3.0, category: 'Masonry' },
    { name: 'Firebox Rebuild - Full', description: 'Remove old firebrick and lay new firebrick in herring or running bond.', baseCost: 450, avgLabor: 16.0, category: 'Masonry' },
    { name: 'Smoke Chamber Parging', description: 'Apply insulating refractory mortar to smooth smoke chamber.', baseCost: 120, avgLabor: 4.0, category: 'Masonry' },
    { name: 'Flue Tile Replacement (Top Section)', description: 'Break out and replace top clay flue liner.', baseCost: 65, avgLabor: 3.0, category: 'Masonry' },
    { name: 'Hearth Stone Installation', description: 'Install slab or tile hearth extension.', baseCost: 150, avgLabor: 5.0, category: 'Masonry' },
    { name: 'Chimney Cap Installation - Stainless Single', description: 'Supply and install single flue stainless steel cap.', baseCost: 140, avgLabor: 1.0, category: 'Masonry' },
    { name: 'Chimney Cap Installation - Custom Multi-Flue', description: 'Measure, supply, and install custom stainless chase cover/cap.', baseCost: 450, avgLabor: 2.5, category: 'Masonry' },

    // --- 4. CONCRETE FLATWORK (Install & Repair) ---
    { name: 'Concrete Driveway - Remove & Replace (Per Sqft)', description: 'Break out old, haul away, form, gravel base, rebar grid, 4000psi concrete.', baseCost: 6.50, avgLabor: 0.15, category: 'Masonry' },
    { name: 'Concrete Sidewalk - Remove & Replace (Per Sqft)', description: '4" thick pour with broom finish. Includes demo and prep.', baseCost: 7.00, avgLabor: 0.18, category: 'Masonry' },
    { name: 'Concrete Patio - Stamped & Colored (Per Sqft)', description: 'Integral color, release agent, stamping pattern, and seal.', baseCost: 9.00, avgLabor: 0.25, category: 'Masonry' },
    { name: 'Concrete Steps - Standard (Per Riser/LF)', description: 'Form and pour concrete steps.', baseCost: 45, avgLabor: 4.0, category: 'Masonry' },
    { name: 'Garage Floor - Pour (Per Sqft)', description: '4" reinforced slab with smooth trowel finish.', baseCost: 5.00, avgLabor: 0.12, category: 'Masonry' },
    { name: 'Concrete Curb Repair (Per LF)', description: 'Form and pour repair section for damaged curb.', baseCost: 15, avgLabor: 1.5, category: 'Masonry' },
    { name: 'Concrete Grinding - Trip Hazard', description: 'Grind raised concrete edge to eliminate trip hazard (up to 1 inch).', baseCost: 25, avgLabor: 1.0, category: 'Maintenance' },
    { name: 'Concrete Sealing - Acrylic (Per Sqft)', description: 'Clean and apply solvent-based acrylic sealer.', baseCost: 0.60, avgLabor: 0.05, category: 'Maintenance' },
    { name: 'Concrete Crack Repair - Epoxy Injection (Per LF)', description: 'Inject structural epoxy into clean crack.', baseCost: 12, avgLabor: 0.5, category: 'Maintenance' },
    { name: 'Self-Leveling Overlay (Per Sqft)', description: 'Prime and pour cementitious overlay to smooth rough concrete.', baseCost: 2.50, avgLabor: 0.1, category: 'Masonry' },
    { name: 'A/C Pad Installation', description: 'Form and pour 3x3 or 4x4 concrete pad for HVAC unit.', baseCost: 85, avgLabor: 4.0, category: 'Masonry' },

    // --- 5. STONE MASONRY (Veneer & Hardscape) ---
    { name: 'Cultured Stone Veneer - Install (Per Sqft)', description: 'Lath, scratch coat, and install manufactured stone with mortar joints.', baseCost: 14, avgLabor: 0.2, category: 'Masonry' },
    { name: 'Natural Thin Stone Veneer - Install (Per Sqft)', description: 'Install natural stone thin veneer.', baseCost: 22, avgLabor: 0.25, category: 'Masonry' },
    { name: 'Full Bed Stone - Install (Per Sqft)', description: 'Install 4-6" structural stone facing (Requires footing).', baseCost: 35, avgLabor: 0.5, category: 'Masonry' },
    { name: 'Dry Stack Stone Wall - Install (Per Sqft Face)', description: 'Build mortarless stone retaining or garden wall.', baseCost: 45, avgLabor: 0.6, category: 'Masonry' },
    { name: 'Flagstone Patio - Wet Lay (Per Sqft)', description: 'Install irregular flagstone on concrete base with mortar joints.', baseCost: 18, avgLabor: 0.4, category: 'Masonry' },
    { name: 'Flagstone Patio - Dry Lay (Per Sqft)', description: 'Install thick flagstone on compacted screenings/sand.', baseCost: 15, avgLabor: 0.35, category: 'Masonry' },
    { name: 'Stone Cap Installation (Per LF)', description: 'Install limestone or bluestone coping on wall.', baseCost: 25, avgLabor: 0.75, category: 'Masonry' },
    { name: 'Stone Repointing - Patio/Walkway (Per Sqft)', description: 'Grind out cracked joints and reinstall mortar/poly-sand.', baseCost: 2.0, avgLabor: 0.15, category: 'Maintenance' },
    { name: 'Mailbox Column - Brick (Standard)', description: 'Build standard brick mailbox with concrete footing.', baseCost: 350, avgLabor: 16.0, category: 'Masonry' },
    { name: 'Mailbox Column - Stone/Custom', description: 'Build custom stone mailbox.', baseCost: 550, avgLabor: 24.0, category: 'Masonry' },

    // --- 6. PAVERS & RETAINING WALLS ---
    { name: 'Paver Patio Installation (Per Sqft)', description: 'Excavate, base prep, install concrete pavers and edge restraints.', baseCost: 9.00, avgLabor: 0.2, category: 'Masonry' },
    { name: 'Paver Driveway Installation (Per Sqft)', description: 'Heavy duty base prep and 80mm paver installation.', baseCost: 12.00, avgLabor: 0.25, category: 'Masonry' },
    { name: 'Retaining Wall - SRW Block (Per Sqft Face)', description: 'Install segmental retaining wall blocks with geogrid and drainage.', baseCost: 18.00, avgLabor: 0.4, category: 'Masonry' },
    { name: 'Retaining Wall - Cap Replacement (Per LF)', description: 'Remove loose caps, clean, and re-glue with construction adhesive.', baseCost: 5.00, avgLabor: 0.5, category: 'Masonry' },
    { name: 'Paver Restoration - Clean & Seal (Per Sqft)', description: 'Pressure wash, re-sand joints, and apply sealer.', baseCost: 1.25, avgLabor: 0.08, category: 'Maintenance' },
    { name: 'Paver Repair - Lift & Relay (Per Sqft)', description: 'Fix sunken or heaved paver sections (base repair included).', baseCost: 3.00, avgLabor: 0.3, category: 'Masonry' },

    // --- 7. STUCCO & PARGING ---
    { name: 'Stucco Patch - Small (< 2 Sqft)', description: 'Repair impact damage or crack in stucco system.', baseCost: 25, avgLabor: 3.0, category: 'Masonry' },
    { name: 'Stucco Recoat/Resurface (Per Sqft)', description: 'Apply new finish coat over existing sound stucco.', baseCost: 1.50, avgLabor: 0.1, category: 'Masonry' },
    { name: 'Foundation Parging (Per Sqft)', description: 'Apply cementitious coating to block or concrete foundation walls.', baseCost: 1.25, avgLabor: 0.15, category: 'Masonry' },
    { name: 'EIFS Repair (Per Sqft)', description: 'Repair synthetic stucco system including mesh and base coat.', baseCost: 8.00, avgLabor: 0.3, category: 'Masonry' },
    { name: 'Wire Lath Installation (Per Sqft)', description: 'Install vapor barrier and metal lath for scratch coat.', baseCost: 0.75, avgLabor: 0.1, category: 'Masonry' },

    // --- 8. FOUNDATION & STRUCTURAL ---
    { name: 'Foundation Crack Injection - Epoxy', description: 'Structural repair of vertical foundation crack (10ft).', baseCost: 150, avgLabor: 4.0, category: 'Masonry' },
    { name: 'Foundation Crack Injection - Urethane', description: 'Waterproofing repair for leaking foundation crack (10ft).', baseCost: 120, avgLabor: 3.5, category: 'Masonry' },
    { name: 'Crawlspace Vent Installation', description: 'Cut block and install automatic temp vent.', baseCost: 45, avgLabor: 2.0, category: 'Masonry' },
    { name: 'Glass Block Window Installation', description: 'Remove old basement window and mortar in glass block panel.', baseCost: 110, avgLabor: 3.5, category: 'Masonry' },
    { name: 'Basement Walkout - Cut & Install Door', description: 'Cut concrete foundation, excavate, and frame for door (Rough only).', baseCost: 850, avgLabor: 32.0, category: 'Masonry' },
    { name: 'Pier & Beam - Masonry Pier Repair', description: 'Rebuild failing brick or block support pier under home.', baseCost: 120, avgLabor: 6.0, category: 'Masonry' },

    // --- 9. TILE & GROUT (Masonry Context) ---
    { name: 'Porch Tile Installation (Per Sqft)', description: 'Install exterior grade tile on concrete porch/steps.', baseCost: 6.00, avgLabor: 0.4, category: 'Masonry' },
    { name: 'Grout Repair / Regrouting (Per Sqft)', description: 'Remove old grout and install new sanded grout.', baseCost: 1.00, avgLabor: 0.2, category: 'Maintenance' },
    { name: 'Tile Loose Repair (Per Tile)', description: 'Remove loose tile, clean substrate, and re-bond.', baseCost: 5.00, avgLabor: 1.0, category: 'Masonry' },

    // --- 10. DEMOLITION & HAULING ---
    { name: 'Masonry Demolition - Hand (Per Hour)', description: 'Jackhammering and removal where machinery cannot access.', baseCost: 25, avgLabor: 1.0, category: 'Other' },
    { name: 'Concrete Disposal Fee (Per Ton)', description: 'Hauling and tipping fees for clean concrete waste.', baseCost: 65, avgLabor: 0.0, category: 'Other' },
    { name: 'Dumpster Rental - 10 Yard (Heavy)', description: 'Concrete/Dirt load dumpster.', baseCost: 450, avgLabor: 0.5, category: 'Other' },
    { name: 'Site Protection & Setup', description: 'Plywood for grass, plastic for windows, dust control.', baseCost: 100, avgLabor: 2.0, category: 'Other' }
];
