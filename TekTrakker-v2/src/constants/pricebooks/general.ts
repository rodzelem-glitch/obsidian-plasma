import { ProposalPreset } from 'types';

export const GENERAL_MASTER_BOOK: Omit<ProposalPreset, 'id' | 'organizationId'>[] = [
    // 1. ASSEMBLY & INSTALLATION
    { name: 'Furniture Assembly - Small (Chair/Side Table)', description: 'Assembly of basic flat-pack furniture items.', baseCost: 0, avgLabor: 0.75, category: 'Other' },
    { name: 'Furniture Assembly - Medium (Desk/Bookshelf)', description: 'Assembly of standard multi-piece furniture.', baseCost: 0, avgLabor: 2, category: 'Other' },
    { name: 'Furniture Assembly - Large (Bed/Wardrobe)', description: 'Complex assembly for large wardrobes or motorized beds.', baseCost: 0, avgLabor: 4, category: 'Other' },
    { name: 'TV Wall Mount - Up to 55"', description: 'Standard mounting on drywall. Includes cable management setup.', baseCost: 45, avgLabor: 1.5, category: 'Accessories' },
    { name: 'TV Wall Mount - 65"+ (Requires 2 Men)', description: 'Heavy duty mounting with reinforcement.', baseCost: 65, avgLabor: 2.5, category: 'Accessories' },
    { name: 'Mirror / Art Hanging - Large', description: 'Secure mounting of heavy mirrors or oversized artwork.', baseCost: 15, avgLabor: 1, category: 'Other' },
    { name: 'Curtain Rod / Blind Installation', description: 'Mounting of window treatments (Per Window).', baseCost: 5, avgLabor: 0.75, category: 'Other' },

    // 2. DOORS & WINDOWS
    { name: 'Door Lock / Deadbolt Replacement', description: 'Swap standard residential door hardware.', baseCost: 0, avgLabor: 0.75, category: 'Contracting' },
    { name: 'Door Adjustment (Stop Rubbing)', description: 'Planing, hinge adjustment, or strike plate realignment.', baseCost: 0, avgLabor: 1, category: 'Contracting' },
    { name: 'Screen Door Repair (Mesh Only)', description: 'Replace damaged insect mesh in standard screen door.', baseCost: 15, avgLabor: 1, category: 'Contracting' },
    { name: 'Weatherstripping Replacement', description: 'Remove old and install new door perimeter seals.', baseCost: 12, avgLabor: 1.5, category: 'Maintenance' },
    { name: 'Window Screen Fabrication', description: 'Build new custom-sized insect screen on site.', baseCost: 25, avgLabor: 1.25, category: 'Contracting' },

    // 3. CARPENTRY & STRUCTURAL REPAIRS
    { name: 'Deck Board Repair (Spot)', description: 'Remove and replace up to 3 damaged deck boards.', baseCost: 45, avgLabor: 2, category: 'Contracting' },
    { name: 'Handrail Repair / Reinforcement', description: 'Secure loose stair or deck railings to code.', baseCost: 10, avgLabor: 1.5, category: 'Contracting' },
    { name: 'Fence Picket Replacement (Per 5)', description: 'Replace broken wood fence pickets.', baseCost: 15, avgLabor: 1, category: 'Contracting' },
    { name: 'Fence Post Reinforcement (Steel Sleeve)', description: 'Strengthen leaning posts without full removal.', baseCost: 45, avgLabor: 2, category: 'Contracting' },

    // 4. DRYWALL & TEXTURE
    { name: 'Drywall Patch - Level 1 (Nail Holes)', description: 'Spackle and sand minor wall defects.', baseCost: 5, avgLabor: 0.5, category: 'Contracting' },
    { name: 'Drywall Patch - Level 2 (Fist Sized)', description: 'Mesh tape and hot mud repair for small holes.', baseCost: 12, avgLabor: 1.5, category: 'Contracting' },
    { name: 'Drywall Patch - Level 3 (Large Section)', description: 'Replace up to 2x2ft section including backing.', baseCost: 25, avgLabor: 3, category: 'Contracting' },
    { name: 'Texture Match - Spray/Hand', description: 'Expert matching of orange peel, knockdown, or skip trowel.', baseCost: 10, avgLabor: 1, category: 'Contracting' },

    // 5. PLUMBING (BASIC)
    { name: 'Faucet Replacement - Simple', description: 'Swap existing bath or kitchen faucet (Like for like).', baseCost: 0, avgLabor: 1.5, category: 'Plumbing' },
    { name: 'Toilet Fill Valve / Flapper Swap', description: 'Stop common leaks and running toilets.', baseCost: 22, avgLabor: 1, category: 'Plumbing' },
    { name: 'Kitchen Sink Basket Strainer', description: 'Replace leaking sink drain flange.', baseCost: 15, avgLabor: 1.25, category: 'Plumbing' },
    { name: 'Garbage Disposal Install (Swap)', description: 'Replace existing disposal unit.', baseCost: 0, avgLabor: 1.5, category: 'Plumbing' },

    // 6. ELECTRICAL (BASIC)
    { name: 'Light Fixture Swap - Standard', description: 'Replace ceiling or wall light in existing box.', baseCost: 0, avgLabor: 1, category: 'Electrical' },
    { name: 'Ceiling Fan Swap (Existing Box)', description: 'Replace fan on fan-rated junction box.', baseCost: 0, avgLabor: 1.5, category: 'Electrical' },
    { name: 'Outlet / Switch Replacement', description: 'Upgrade worn or discolored devices.', baseCost: 2, avgLabor: 0.5, category: 'Electrical' },
    { name: 'GFCI Outlet Upgrade', description: 'Add safety protection to kitchen/bath circuits.', baseCost: 25, avgLabor: 0.75, category: 'Electrical' },

    // 7. EXTERIOR MAINTENANCE
    { name: 'Gutter Cleaning - Standard House', description: 'Clear debris and verify downspout flow.', baseCost: 0, avgLabor: 2, category: 'Maintenance' },
    { name: 'Pressure Wash - Walkway/Small Porch', description: 'Surface cleaning to remove mold and stains.', baseCost: 5, avgLabor: 1.5, category: 'Maintenance' },
    { name: 'Caulking - Window / Door (Exterior)', description: 'Apply high-grade sealant to prevent drafts.', baseCost: 12, avgLabor: 1, category: 'Maintenance' },

    // 8. SAFETY & TECH
    { name: 'Smoke / CO Detector Install', description: 'Mount and test safety alarms.', baseCost: 0, avgLabor: 0.5, category: 'Accessories' },
    { name: 'Ring / Nest Doorbell Install', description: 'Mount and connect smart video doorbell.', baseCost: 0, avgLabor: 1, category: 'Accessories' },
    { name: 'Smart Lock Installation', description: 'Retrofit standard deadbolt with smart tech.', baseCost: 0, avgLabor: 1.25, category: 'Accessories' },
];
