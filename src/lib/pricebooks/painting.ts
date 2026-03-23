
import { ProposalPreset } from '@types';

export const PAINTING_MASTER_BOOK: Omit<ProposalPreset, 'id' | 'organizationId'>[] = [
    // --- 1. PREPARATION & SETUP ---
    { name: 'Room Setup - Standard Furniture Move', description: 'Protecting and moving standard residential furniture away from walls.', baseCost: 0, avgLabor: 1.5, category: 'Painting' },
    { name: 'Masking & Taping - Full Room', description: 'Precision masking of floors, windows, and hardware using blue tape and paper.', baseCost: 25, avgLabor: 2.0, category: 'Painting' },
    { name: 'Drywall Patching - Minor (Nail Holes)', description: 'Spackling and sanding of standard nail holes and minor scuffs.', baseCost: 5, avgLabor: 0.75, category: 'Painting' },
    { name: 'Drywall Patching - Moderate (Fist Sized)', description: 'Patching, taping, and texturing of small holes (Includes dry time).', baseCost: 15, avgLabor: 2.0, category: 'Painting' },
    { name: 'Caulking - Baseboards / Trim (Per Room)', description: 'Application of paintable latex caulk to gaps for a professional finish.', baseCost: 12, avgLabor: 1.0, category: 'Painting' },
    { name: 'Lead Paint Stabilization Prep', description: 'Wet scraping and specialized cleanup for pre-1978 homes (EPA RRP).', baseCost: 85, avgLabor: 4.0, category: 'Painting' },
    { name: 'Wallpaper Removal (Per Room)', description: 'Steam and scrape existing paper (Includes adhesive removal).', baseCost: 35, avgLabor: 4.0, category: 'Painting' },
    { name: 'Surface Degreasing (Kitchen)', description: 'TSP wash of kitchen walls/cabinets prior to painting.', baseCost: 10, avgLabor: 1.5, category: 'Painting' },

    // --- 2. INTERIOR WALLS & CEILINGS ---
    { name: 'Wall Painting - Single Coat (Per Sqft)', description: 'Standard refresh coat on walls in good condition.', baseCost: 0.15, avgLabor: 0.02, category: 'Painting' },
    { name: 'Wall Painting - Two Coats (Per Sqft)', description: 'Full coverage painting including primer or two finish coats.', baseCost: 0.25, avgLabor: 0.04, category: 'Painting' },
    { name: 'Ceiling Painting - Per Room (Flat)', description: 'Roll or spray ceiling for uniform white or custom color.', baseCost: 15, avgLabor: 1.5, category: 'Painting' },
    { name: 'Ceiling Painting - Vaulted/High (Add-on)', description: 'Additional labor/scaffolding for ceilings over 10ft.', baseCost: 0, avgLabor: 2.0, category: 'Painting' },
    { name: 'Popcorn Ceiling Removal (Per Sqft)', description: 'Scrape, sand, and prep for texture (Includes specialized cleanup).', baseCost: 0.50, avgLabor: 0.1, category: 'Painting' },
    { name: 'Accent Wall - Custom Color Charge', description: 'Setup and execution of a single contrasting wall color.', baseCost: 15, avgLabor: 1.0, category: 'Painting' },
    { name: 'Texture Application - Orange Peel (Per Sqft)', description: 'Spray application of light to medium texture.', baseCost: 0.10, avgLabor: 0.03, category: 'Painting' },
    { name: 'Texture Application - Knockdown (Per Sqft)', description: 'Spray and trowel finish for knockdown texture.', baseCost: 0.12, avgLabor: 0.04, category: 'Painting' },

    // --- 3. INTERIOR TRIM & DOORS ---
    { name: 'Baseboard Painting (Per LF)', description: 'Brush finish on floor moldings.', baseCost: 0.20, avgLabor: 0.05, category: 'Painting' },
    { name: 'Crown Molding Painting (Per LF)', description: 'Detailed brush work on decorative ceiling moldings.', baseCost: 0.35, avgLabor: 0.08, category: 'Painting' },
    { name: 'Door Painting - Standard Interior', description: 'Paint both sides of standard slab or paneled door.', baseCost: 12, avgLabor: 1.0, category: 'Painting' },
    { name: 'Door Painting - French/Multi-Pane', description: 'Detailed painting of individual panes and muntins.', baseCost: 18, avgLabor: 2.5, category: 'Painting' },
    { name: 'Door Frame / Casing Painting', description: 'Prep and paint interior door trim set.', baseCost: 8, avgLabor: 0.75, category: 'Painting' },
    { name: 'Window Sash / Frame Painting', description: 'Detailed painting of wood window components.', baseCost: 15, avgLabor: 1.5, category: 'Painting' },
    { name: 'Cabinet Refinishing - Per Door/Drawer', description: 'Degrease, sand, prime, and spray finish for cabinetry.', baseCost: 45, avgLabor: 3.0, category: 'Painting' },
    { name: 'Cabinet Box/Frame Painting (Per LF)', description: 'Painting of face frames and exposed sides.', baseCost: 15, avgLabor: 1.0, category: 'Painting' },
    { name: 'Handrail Staining/Painting (Per LF)', description: 'Detailed finish on stair handrails.', baseCost: 2.0, avgLabor: 0.25, category: 'Painting' },
    { name: 'Spindle/Baluster Painting (Per Unit)', description: 'Individual painting of stair spindles.', baseCost: 1.0, avgLabor: 0.2, category: 'Painting' },

    // --- 4. EXTERIOR SIDING & MASONRY ---
    { name: 'Exterior Siding - Per Sqft (Brush/Roll)', description: 'Standard painting for wood or fiber cement siding.', baseCost: 0.30, avgLabor: 0.06, category: 'Painting' },
    { name: 'Exterior Siding - Per Sqft (Spray)', description: 'High-production spray finish for large exterior surfaces.', baseCost: 0.20, avgLabor: 0.03, category: 'Painting' },
    { name: 'Brick Painting / Limewashing (Per Sqft)', description: 'Application of breathable masonry paint or traditional lime wash.', baseCost: 0.45, avgLabor: 0.08, category: 'Painting' },
    { name: 'Stucco Sealing & Painting (Per Sqft)', description: 'Elastomeric coating application for waterproof protection.', baseCost: 0.50, avgLabor: 0.07, category: 'Painting' },
    { name: 'Exterior Trim Painting (Per LF)', description: 'Painting of corner boards, window trim, and frieze boards.', baseCost: 0.50, avgLabor: 0.1, category: 'Painting' },

    // --- 5. EXTERIOR TRIM & DECKS ---
    { name: 'Soffit & Fascia Painting (Per LF)', description: 'Reach painting of roof line wood/metal trim.', baseCost: 0.40, avgLabor: 0.1, category: 'Painting' },
    { name: 'Exterior Door Refinishing - Wood/Fiberglass', description: 'Sand and apply UV-rated stain or high-performance paint.', baseCost: 65, avgLabor: 4.0, category: 'Painting' },
    { name: 'Deck Staining - Standard Wash & Seal (Per Sqft)', description: 'Clean and apply semi-transparent or solid deck stain.', baseCost: 1.20, avgLabor: 0.15, category: 'Painting' },
    { name: 'Deck Spindle/Rail Painting (Per LF)', description: 'Detailed painting of deck railing systems.', baseCost: 3.50, avgLabor: 0.3, category: 'Painting' },
    { name: 'Fence Painting / Staining (Per Section)', description: 'Application of protective finish to 8ft wood fence panels.', baseCost: 15, avgLabor: 1.0, category: 'Painting' },
    { name: 'Garage Door Painting (Standard)', description: 'Paint exterior of standard metal/wood garage door.', baseCost: 25, avgLabor: 2.0, category: 'Painting' },
    { name: 'Shutters - Remove, Paint & Reinstall (Pair)', description: 'Take down, spray finish, and re-hang shutters.', baseCost: 15, avgLabor: 1.5, category: 'Painting' },

    // --- 6. SPECIALTY COATINGS ---
    { name: 'Garage Floor Epoxy (Per Sqft)', description: 'Industrial grade 2-part epoxy with decorative flakes.', baseCost: 1.50, avgLabor: 0.12, category: 'Painting' },
    { name: 'Metal Railing Painting (Per LF)', description: 'Scrape rust and apply DTM (Direct-to-Metal) enamel.', baseCost: 5, avgLabor: 0.5, category: 'Painting' },
    { name: 'Fireplace Mantle Refinishing', description: 'Detailed sanding and staining or painting of mantle.', baseCost: 25, avgLabor: 3.0, category: 'Painting' },
    { name: 'Pool Deck Resurfacing (Per Sqft)', description: 'Apply cool-deck or acrylic textured coating.', baseCost: 2.00, avgLabor: 0.15, category: 'Painting' },
    { name: 'Concrete Stain & Seal (Per Sqft)', description: 'Acid stain or solid color stain for patios/driveways.', baseCost: 0.85, avgLabor: 0.1, category: 'Painting' },

    // --- 7. CLEANING & PRESSURE WASHING ---
    { name: 'Pressure Washing - Siding (Per Sqft)', description: 'Soft wash removal of algae, mold, and dirt.', baseCost: 0.05, avgLabor: 0.01, category: 'Maintenance' },
    { name: 'Pressure Washing - Driveway/Walkway (Per Sqft)', description: 'High-pressure surface cleaning of concrete.', baseCost: 0.08, avgLabor: 0.02, category: 'Maintenance' },
    { name: 'Gutter Exterior - Hand Scrub (Per LF)', description: 'Removal of "tiger stripes" from gutter faces.', baseCost: 0.50, avgLabor: 0.1, category: 'Maintenance' },
    { name: 'Deck Stripping (Chemical)', description: 'Apply stripping agent and power wash to remove old stain.', baseCost: 0.75, avgLabor: 0.1, category: 'Painting' },
    { name: 'Roof Soft Wash (Per Sqft)', description: 'Chemical treatment to remove gloeocapsa magma (black streaks).', baseCost: 0.15, avgLabor: 0.03, category: 'Maintenance' },

    // --- 8. DIAGNOSTICS & COLOR CONSULT ---
    { name: 'Color Consultation - In Home', description: 'Professional selection of color palettes and finishes with samples.', baseCost: 0, avgLabor: 1.5, category: 'Diagnostics' },
    { name: 'Moisture Testing - Wood/Drywall', description: 'Pin-style moisture probe testing prior to coating.', baseCost: 0, avgLabor: 0.5, category: 'Diagnostics' },
    { name: 'Adhesion Tape Test', description: 'ASTM standard testing to verify bond of existing coatings.', baseCost: 0, avgLabor: 0.75, category: 'Diagnostics' },
    { name: 'Lead Paint Test (Swab)', description: 'Instant chemical swab test for lead presence.', baseCost: 10, avgLabor: 0.25, category: 'Diagnostics' }
];
