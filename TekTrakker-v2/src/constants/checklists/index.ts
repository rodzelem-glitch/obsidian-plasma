import { InspectionTemplateItem } from '../../types';

export const CHECKLISTS: Record<string, {name: string, items: Omit<InspectionTemplateItem, 'id'>[]}[]> = {
    HVAC: [
        {
            name: "HVAC - Active Diagnostic & Service Checklist",
            items: [
                { label: "Execute LOTO (Lockout/Tagout) at main breaker before service.", type: "PassFail", required: true },
                { label: "Record initial ambient indoor and outdoor dry-bulb / wet-bulb temps.", type: "Textarea", required: true },
                { label: "Inspect system air filters; record size and MERV rating.", type: "Text", required: true },
                { label: "Measure capacitor microfarad reading vs. nameplate rating.", type: "Text", required: true },
                { label: "Inspect contactor for pitting, burns, or voltage drops.", type: "PassFail", required: true },
                { label: "Measure compressor and condenser fan motor amp draw vs. RLA.", type: "Textarea", required: true },
                { label: "Inspect heat exchanger for cracks or rust via borescope (if gas).", type: "Photo", required: false },
                { label: "Clean and check flame sensor uA reading.", type: "Text", required: false },
                { label: "Verify proper venting and perform carbon monoxide (CO) draft test.", type: "PassFail", required: true },
                { label: "Measure Total External Static Pressure (TESP) Supply/Return.", type: "Textarea", required: true },
                { label: "Attach manifold gauges; record Superheat / Subcooling target vs. actual.", type: "Textarea", required: true },
                { label: "Inspect condensate pan and flush primary/secondary drain lines.", type: "PassFail", required: true },
                { label: "Verify ductwork condition in immediately visible envelope.", type: "Textarea", required: false },
                { label: "Test defrost cycle initiation (Heat pumps only).", type: "PassFail", required: false },
                { label: "Take overall status photo of internal components before closing unit.", type: "Photo", required: true }
            ]
        },
        {
            name: "HVAC - Final Site Integrity & Walkthrough",
            items: [
                { label: "Confirm LOTO tags removed and high-voltage power safely restored.", type: "PassFail", required: true },
                { label: "Verify thermostat calibration and observe system staging through 1 full cycle.", type: "PassFail", required: true },
                { label: "Ensure all cabinet access panels are secured with all structural screws.", type: "PassFail", required: true },
                { label: "Confirm EPA 608 compliance if refrigerant was reclaimed; log cylinder weights.", type: "Textarea", required: true },
                { label: "Ensure all service valve caps are replaced and tightened.", type: "PassFail", required: true },
                { label: "Pack out all drop cloths, shoe covers, packing materials, and debris.", type: "PassFail", required: true },
                { label: "Sweep or vacuum any dust/shavings around the indoor air handler.", type: "PassFail", required: true },
                { label: "Demonstrate thermostat operation, scheduling, and filter location to customer.", type: "PassFail", required: true },
                { label: "Review invoice line items and diagnostic findings with customer.", type: "PassFail", required: true },
                { label: "Final wide-angle photo of cleaned indoor unit space.", type: "Photo", required: true },
                { label: "Final wide-angle photo of cleaned outdoor condenser pad.", type: "Photo", required: true }
            ]
        }
    ],
    Plumbing: [
        {
            name: "Plumbing - Active Assessment & Rough-in Checklist",
            items: [
                { label: "Identify and locate main municipal water shut-off valve.", type: "PassFail", required: true },
                { label: "Measure resting house water pressure (Target: 40-80 PSI).", type: "Text", required: true },
                { label: "Check water heater temperature, age, and T&P valve function.", type: "Textarea", required: true },
                { label: "Inspect visible supply lines (copper/PEX/CPVC) for pinhole leaks or corrosion.", type: "PassFail", required: true },
                { label: "Assess DWV (Drain Waste Vent) slopes and venting for compliance.", type: "PassFail", required: true },
                { label: "Identify lead or polybutylene piping if present.", type: "PassFail", required: true },
                { label: "Check fixture aerators and flow rates.", type: "Text", required: false },
                { label: "Perform visual inspection of exposed main sewer cleanouts.", type: "Photo", required: true },
                { label: "Camera snake main line if backing up; record distance to block.", type: "Textarea", required: false },
                { label: "Document existing localized water damage before starting repairs.", type: "Photo", required: true },
                { label: "Verify confined space safety and gas meter locations before trenching.", type: "PassFail", required: true }
            ]
        },
        {
            name: "Plumbing - Post-Repair Dry Check & Walkthrough",
            items: [
                { label: "Restore main water pressure and bleed air from all fixtures.", type: "PassFail", required: true },
                { label: "Subject repaired fixtures/joints to full static pressure for 15+ mins.", type: "PassFail", required: true },
                { label: "Perform 'paper towel test' on all new fittings to confirm zero weep.", type: "PassFail", required: true },
                { label: "Flush newly installed toilets 3 times to check wax ring seal.", type: "PassFail", required: true },
                { label: "Check under surrounding vanities / subfloors for water.", type: "PassFail", required: true },
                { label: "Mop up any spillage and dry out the cabinet base completely.", type: "PassFail", required: true },
                { label: "Remove all pipe cuttings, PVC primer cans, solder, and flux.", type: "PassFail", required: true },
                { label: "Caulk edges of new tubs/sinks and verify smooth bead.", type: "PassFail", required: false },
                { label: "Walk customer through operation of new valves or appliances.", type: "PassFail", required: true },
                { label: "Photo documenting bone-dry joints under the sink.", type: "Photo", required: true },
                { label: "Advise customer on drain maintenance (Bio-Clean usage, etc.).", type: "Textarea", required: true }
            ]
        }
    ],
    Electrical: [
        {
            name: "Electrical - Active Diagnostics & Safety Audit",
            items: [
                { label: "Verify proper LOTO protocols before opening main service equipment.", type: "PassFail", required: true },
                { label: "Inspect main service mast, weatherhead, and meter base for damage.", type: "PassFail", required: true },
                { label: "Measure incoming voltage across legs (L1-N, L2-N, L1-L2).", type: "Textarea", required: true },
                { label: "Examine panel buss bars for pitting or thermal damage.", type: "Photo", required: true },
                { label: "Check main grounding electrode conductor (GEC) connection.", type: "PassFail", required: true },
                { label: "Look for double-tapped breakers or oversized breakers for wire gauge.", type: "PassFail", required: true },
                { label: "Verify presence of AFCI/GFCI protection per current NEC code.", type: "PassFail", required: true },
                { label: "Test suspect outlets for correct polarity and open grounds.", type: "PassFail", required: true },
                { label: "Perform continuity tests on dead circuits before replacing components.", type: "PassFail", required: true },
                { label: "Calculate circuit load to ensure additions will not overload existing breaker.", type: "Textarea", required: false },
                { label: "Take pre-work photo of messy junction boxes or hazards.", type: "Photo", required: true }
            ]
        },
        {
            name: "Electrical - Commissioning & Site Cleansing",
            items: [
                { label: "Re-energize main breaker and clear tags.", type: "PassFail", required: true },
                { label: "Perform voltage drop tests on newly installed high-draw circuits.", type: "Text", required: true },
                { label: "Test trip GFCI/AFCI receptacles using internal test buttons.", type: "PassFail", required: true },
                { label: "Verify smart-switch / dimmer ranges (no LED flickering).", type: "PassFail", required: false },
                { label: "Ensure all junction box covers and panel dead-fronts are securely installed.", type: "PassFail", required: true },
                { label: "Properly label the main panel index card for new circuits.", type: "PassFail", required: true },
                { label: "Sweep and vacuum drywall dust, wire strippings, and staple shards.", type: "PassFail", required: true },
                { label: "Securely dispose of replaced mercury-containing bulbs or old ballasts.", type: "PassFail", required: true },
                { label: "Walk customer through tripping and resetting GFCI boundaries.", type: "PassFail", required: true },
                { label: "Final photo of the closed and labeled breaker panel.", type: "Photo", required: true }
            ]
        }
    ],
    Landscaping: [
        {
            name: "Landscaping - Pre-Mobilization & Site Prep",
            items: [
                { label: "Locate and flag all underground utilities (811 Call verified).", type: "PassFail", required: true },
                { label: "Identify property lines and HOA setbacks.", type: "PassFail", required: true },
                { label: "Check soil composition and moisture level (clay, sand, loam).", type: "Text", required: true },
                { label: "Run existing irrigation zones to document pre-existing broken heads.", type: "Textarea", required: true },
                { label: "Take photo of existing diseased or dying plants targeted for removal.", type: "Photo", required: true },
                { label: "Verify clearance for heavy equipment gates and hardscapes.", type: "PassFail", required: true },
                { label: "Review planting plans with foreman ensuring right plant/right place.", type: "PassFail", required: true },
                { label: "Set up safety cones and barricades if working near roadways.", type: "PassFail", required: true },
                { label: "Apply erosion controls/silt fences if grading is involved.", type: "PassFail", required: false }
            ]
        },
        {
            name: "Landscaping - Final Grade & Property Turnover",
            items: [
                { label: "Check final grading slopes away from the foundation (minimum 5%).", type: "PassFail", required: true },
                { label: "Ensure all new tree root flares are exposed, not buried in mulch.", type: "PassFail", required: true },
                { label: "Verify mulch/rock beds are spread to specified depth (2-3 inches).", type: "Text", required: true },
                { label: "Run irrigation again to verify new rootball coverage and no dry spots.", type: "PassFail", required: true },
                { label: "Blow off all patios, walkways, driveways, and street curbs.", type: "PassFail", required: true },
                { label: "Remove all pallets, pots, tags, and excess soil/sod from the property.", type: "PassFail", required: true },
                { label: "Ensure gates are securely closed and latched after exiting.", type: "PassFail", required: true },
                { label: "Review seasonal watering schedule and pruning instructions with client.", type: "PassFail", required: true },
                { label: "Provide written plant warranty documentation.", type: "Textarea", required: true },
                { label: "Post-installation wide-angle photo of the completed bed.", type: "Photo", required: true }
            ]
        }
    ],
    General: [
        {
            name: "General Contractor - Safety & Pre-Construction",
            items: [
                { label: "Verify site permits and zoning notices are physically posted.", type: "PassFail", required: true },
                { label: "Check sub-contractor COIs (Certificates of Insurance) on file.", type: "PassFail", required: true },
                { label: "Establish temporary power and water hookups.", type: "PassFail", required: true },
                { label: "Erect dust barriers (ZipWalls) and set up HEPA negative air scrubbers.", type: "PassFail", required: true },
                { label: "Cover all HVAC supply/return registers in the active zone.", type: "PassFail", required: true },
                { label: "Lay Ram Board or heavy drop cloths across client traffic paths.", type: "PassFail", required: true },
                { label: "Conduct lead/asbestos testing if property built pre-1978.", type: "Textarea", required: true },
                { label: "Take 360-degree 'Before' photos of all rooms involved.", type: "Photo", required: true },
                { label: "Review timeline milestones and daily working hours with homeowner.", type: "Textarea", required: true }
            ]
        },
        {
            name: "General Contractor - Punch List & Demobilization",
            items: [
                { label: "Execute critical phase inspections (framing, rough-in) passed by city.", type: "PassFail", required: true },
                { label: "Review final punch list to ensure zero incomplete trim or paint tasks.", type: "Textarea", required: true },
                { label: "Test all new doors and windows for smooth sliding and locking.", type: "PassFail", required: true },
                { label: "Remove all ZipWalls and dust barriers without damaging existing paint.", type: "PassFail", required: true },
                { label: "Perform deep clean of the area (HEPA vacuuming, wiping surfaces).", type: "PassFail", required: true },
                { label: "Remove dumpsters and portable toilets from the property.", type: "PassFail", required: true },
                { label: "Hand over all warranty packets and appliance manuals to the client.", type: "PassFail", required: true },
                { label: "Perform final client walkthrough and collect sign-off signature.", type: "PassFail", required: true },
                { label: "Capture final 'After' showcase photos for the portfolio.", type: "Photo", required: true }
            ]
        }
    ],
    Cleaning: [
        {
            name: "Commercial/Residential Cleaning - Initial Walk & Prep",
            items: [
                { label: "Complete preliminary walkthrough to identify client focal points.", type: "Textarea", required: true },
                { label: "Identify pre-existing damage (scratches on hardwood, chipped tiles).", type: "Photo", required: true },
                { label: "Cross-check the MSDS (Safety Data Sheets) for planned chemical usage.", type: "PassFail", required: true },
                { label: "Mix dilutable solutions properly according to label ratios.", type: "PassFail", required: true },
                { label: "Verify appropriate PPE (gloves, shoe covers, masks) is worn.", type: "PassFail", required: true },
                { label: "Ensure proper ventilation if using bleach or heavy solvents.", type: "PassFail", required: true },
                { label: "Prioritize rooms (e.g. top-down cleaning, dry dusting before wet mopping).", type: "PassFail", required: true }
            ]
        },
        {
            name: "Commercial/Residential Cleaning - Quality Control & Exit",
            items: [
                { label: "Ensure all high-dusting (ceiling fans, cobwebs, crown molding) is finished.", type: "PassFail", required: true },
                { label: "Wipe down all baseboards, door frames, and light switches.", type: "PassFail", required: true },
                { label: "Deep scrub bathroom grout and shine all chrome fixtures/mirrors.", type: "PassFail", required: true },
                { label: "Clean inside microwave and wipe down all kitchen appliance exteriors.", type: "PassFail", required: true },
                { label: "Empty all trash receptacles and replace with fresh liners.", type: "PassFail", required: true },
                { label: "Vacuum all carpets including under easily movable furniture.", type: "PassFail", required: true },
                { label: "Mop hard floors leaving a streak-free, footprint-free finish.", type: "PassFail", required: true },
                { label: "Lock all doors and arm security system (if applicable) upon exit.", type: "PassFail", required: true },
                { label: "Photo of main living/lobby area showing pristine condition.", type: "Photo", required: true },
                { label: "Leave a signed company calling card or checklist stub for the client.", type: "PassFail", required: true }
            ]
        }
    ],
    Painting: [
        {
            name: "Painting - Substrate Prep & Masking Checklist",
            items: [
                { label: "Confirm exact paint brand, sheen, and color codes with the client.", type: "Textarea", required: true },
                { label: "Measure wall moisture content if painting exterior walls.", type: "Text", required: false },
                { label: "Remove switch plates, outlet covers, and wall hardware.", type: "PassFail", required: true },
                { label: "Setup drop cloths seamlessly from baseboards to walkway exits.", type: "PassFail", required: true },
                { label: "Degrease and TSP wash walls (especially kitchens/baths).", type: "PassFail", required: true },
                { label: "Scrape loose paint, feather edge sand, and spackle all nail holes.", type: "PassFail", required: true },
                { label: "Apply stain-blocking primer to water damage or smoke stains.", type: "PassFail", required: true },
                { label: "Tape off trim, windows, and contiguous unpainted surfaces.", type: "PassFail", required: true },
                { label: "Photo of fully taped and patched room prior to cutting in.", type: "Photo", required: true }
            ]
        },
        {
            name: "Painting - Finish Curing & Unmasking",
            items: [
                { label: "Inspect walls with a flashlight for 'holidays' (missed spots) or roller marks.", type: "PassFail", required: true },
                { label: "Check all cut-in lines along the ceiling and trim for sharpness.", type: "PassFail", required: true },
                { label: "Carefully remove blue tape while paint is still mildly tacky to prevent tearing.", type: "PassFail", required: true },
                { label: "Reinstall all switch plates, outlet covers, and door hardware.", type: "PassFail", required: true },
                { label: "Clean brushes/rollers only in designated areas; do not dump wash in lawns.", type: "PassFail", required: true },
                { label: "Seal leftover paint cans firmly; label the lid with room/color for the client.", type: "PassFail", required: true },
                { label: "Remove drop cloths and sweep/vacuum any stray dust from sanding.", type: "PassFail", required: true },
                { label: "Open windows / run fans slightly to aid in fume dissipation.", type: "PassFail", required: true },
                { label: "Walk the perimeter with the client for final touch-up signoff.", type: "PassFail", required: true },
                { label: "Photo of the completed and cleaned focus wall.", type: "Photo", required: true }
            ]
        }
    ],
    Roofing: [
        {
            name: "Roofing - Decking Diagnostics & Tear-Off",
            items: [
                { label: "Assess current weather forecast (wind speeds and precipitation).", type: "Textarea", required: true },
                { label: "Setup OSHA-compliant tie-offs and anchor points before ascending.", type: "PassFail", required: true },
                { label: "Park dumpster safely avoiding driveway cracking (use plywood pads).", type: "PassFail", required: true },
                { label: "Drape tarps over AC units, shrubs, and fragile landscaping.", type: "PassFail", required: true },
                { label: "Begin tear-off; inspect underlayment and OSB/plywood decking for rot.", type: "PassFail", required: true },
                { label: "Document and photograph any rotted joists or decking requiring change orders.", type: "Photo", required: true },
                { label: "Ensure ice and water shield is applied to eaves and valleys.", type: "PassFail", required: true },
                { label: "Check existing flashing around chimneys and vent pipes for reuse viability.", type: "Text", required: true },
                { label: "Verify drip edge is properly aligned and nailed.", type: "PassFail", required: true }
            ]
        },
        {
            name: "Roofing - Ridge Completion & Hazard Clear",
            items: [
                { label: "Verify shingle stagger pattern and nail counts per shingle.", type: "PassFail", required: true },
                { label: "Ensure ridge vent is accurately cut and securely capped.", type: "PassFail", required: true },
                { label: "Apply roofing cement/sealant to exposed nail heads and flashings.", type: "PassFail", required: true },
                { label: "Scrape down gutters and clear them of all shingle grit/nails.", type: "PassFail", required: true },
                { label: "Run the magnetic sweeper 3 times across the driveway and lawn.", type: "PassFail", required: true },
                { label: "Remove all tarps and inspect landscaping for incidental damage.", type: "PassFail", required: true },
                { label: "Haul away old material and demobilize dumpster.", type: "PassFail", required: true },
                { label: "Provide client with the manufacturer's shingle warranty packet.", type: "PassFail", required: true },
                { label: "Capture drone or high-angle photos of the finished roof planes and ridges.", type: "Photo", required: true }
            ]
        }
    ],
    Contracting: [
        {
            name: "Contracting - Code Compliance & Structural Review",
            items: [
                { label: "Review approved blueprints against actual framed dimensions.", type: "Textarea", required: true },
                { label: "Verify header sizes, stud spacing (16-in OC), and load-bearing columns.", type: "PassFail", required: true },
                { label: "Check foundation rebar grid spacing and vapor barriers before pouring.", type: "PassFail", required: true },
                { label: "Ensure rough plumbing maintains proper drain slope.", type: "PassFail", required: true },
                { label: "Ensure rough electrical wires are properly stapled and protected by nail plates.", type: "PassFail", required: true },
                { label: "Verify HVAC ductwork is insulated and sealed with mastic.", type: "PassFail", required: true },
                { label: "Call in municipal inspector for rough-in signoff.", type: "PassFail", required: true },
                { label: "Take pre-drywall photos documenting all in-wall utilities.", type: "Photo", required: true }
            ]
        },
        {
            name: "Contracting - Turning Over Keys (Final Checks)",
            items: [
                { label: "Verify all municipal final inspections (C of O) have passed and certificates retrieved.", type: "PassFail", required: true },
                { label: "Check all doors for binding or uneven gaps.", type: "PassFail", required: true },
                { label: "Ensure HVAC system filter is changed post-construction dust.", type: "PassFail", required: true },
                { label: "Run all water fixtures simultaneously to check for pressure drops or hidden leaks.", type: "PassFail", required: true },
                { label: "Test all smoke detectors and carbon monoxide alarms.", type: "PassFail", required: true },
                { label: "Verify weatherstripping and caulking is complete on all exterior penetrations.", type: "PassFail", required: true },
                { label: "Execute commercial-grade post-construction clean.", type: "PassFail", required: true },
                { label: "Deliver binder containing all appliance manuals, warranties, and paint codes.", type: "Textarea", required: true },
                { label: "Obtain client's Final Completion Sign-off signature.", type: "PassFail", required: true }
            ]
        }
    ],
    Masonry: [
        {
            name: "Masonry - Mortar Prep & Substrate Integrity",
            items: [
                { label: "Verify footing depths extend below the local frost line.", type: "PassFail", required: true },
                { label: "Check reinforcing rebar/wire mesh gauge and layout.", type: "Textarea", required: true },
                { label: "Confirm brick/stone style and mortar pigment match with client.", type: "PassFail", required: true },
                { label: "Set up level lines, string guides, and scaffolding.", type: "PassFail", required: true },
                { label: "Ensure weather conditions exceed 40°F (or utilize thermal blankets/heating).", type: "PassFail", required: true },
                { label: "Check base wall ties and weep hole spacing intervals.", type: "PassFail", required: true },
                { label: "Photo of footing and reinforcing steel prior to pouring/laying.", type: "Photo", required: true }
            ]
        },
        {
            name: "Masonry - Finishing Joints & Acid Wash",
            items: [
                { label: "Use jointer tool to strike/finish joints before mortar cures fully.", type: "PassFail", required: true },
                { label: "Brush off excess mortar crumbs from the brick face.", type: "PassFail", required: true },
                { label: "Wait appropriate curing time before applying muriatic acid wash.", type: "PassFail", required: true },
                { label: "Hose down surrounding landscaping heavily to dilute acid runoff.", type: "PassFail", required: true },
                { label: "Safely dismantle all wooden forms and scaffolding.", type: "PassFail", required: true },
                { label: "Clean mortar mixer and tools off-site or away from client drains.", type: "PassFail", required: true },
                { label: "Inspect final wall/patio for level, plumb, and square alignments.", type: "PassFail", required: true },
                { label: "Sweep entire area and remove all broken brick / stone rubble.", type: "PassFail", required: true },
                { label: "Photo of the washed and finished masonry work.", type: "Photo", required: true }
            ]
        }
    ],
    Telecommunications: [
        {
            name: "Telecom - Line Quality & Rack Setup",
            items: [
                { label: "Document client's desired network topology / ISP demarc extension.", type: "Textarea", required: true },
                { label: "Identify firewalls or penetrations requiring fire-stopping putty.", type: "PassFail", required: true },
                { label: "Check conduit for impedance before feeding pulling tape.", type: "PassFail", required: true },
                { label: "Ensure cables maintain a safe distance from high-voltage electrical runs.", type: "PassFail", required: true },
                { label: "Verify bend radius limitations are not exceeded on Fiber or CAT6a.", type: "PassFail", required: true },
                { label: "Run test tone from demarc to drop points.", type: "PassFail", required: true },
                { label: "Photo of the exposed server rack before dress-in.", type: "Photo", required: true }
            ]
        },
        {
            name: "Telecom - Termination & Signal Validation",
            items: [
                { label: "Terminate all endpoints using T568A or T568B consistency.", type: "PassFail", required: true },
                { label: "Run Fluke/Certifier tests on all lines for crosstalk and attenuation losses.", type: "Textarea", required: true },
                { label: "Apply printed logic labels to both ends of every cable.", type: "PassFail", required: true },
                { label: "Dress cables in the rack using velcro straps (not zip-ties compressing jackets).", type: "PassFail", required: true },
                { label: "Seal all wall penetrations with approved fire-block.", type: "PassFail", required: true },
                { label: "Vacuum all drywall dust and wire clippings from the server room.", type: "PassFail", required: true },
                { label: "Verify active IP DHCP handshakes with client equipment.", type: "PassFail", required: true },
                { label: "Export and provide cable certification report to client IT.", type: "PassFail", required: true },
                { label: "Photo of the dressed and labeled patch panel.", type: "Photo", required: true }
            ]
        }
    ],
    Solar: [
        {
            name: "Solar - Array Topology & Mounting Verification",
            items: [
                { label: "Audit the roof covering condition beneath proposed array zones.", type: "PassFail", required: true },
                { label: "Measure roof rafter spacing and identify secure lag bolt paths.", type: "Text", required: true },
                { label: "Inject high-grade roof sealant into all mounting pilot holes.", type: "PassFail", required: true },
                { label: "Install racking system; verify it is squared and flush via level.", type: "PassFail", required: true },
                { label: "Check grounding copper wire bonds across all rails and panels.", type: "PassFail", required: true },
                { label: "Mount micro-inverters or optimizers; note serial numbers to layout map.", type: "Textarea", required: true },
                { label: "Test open-circuit voltage (Voc) string integrity before plugging.", type: "PassFail", required: true },
                { label: "Photo of the bare panel mounting system showing secure flashings.", type: "Photo", required: true }
            ]
        },
        {
            name: "Solar - Grid Sync & Final Delivery",
            items: [
                { label: "Wire the main junction box and DC disconnects. Torque down all lugs.", type: "PassFail", required: true },
                { label: "Apply required safety and arc flash warning placards to the main panel.", type: "PassFail", required: true },
                { label: "Coordinate with local utility for PTO (Permission To Operate).", type: "PassFail", required: true },
                { label: "Turn on AC disconnects and verify inverter powers up without faults.", type: "PassFail", required: true },
                { label: "Check production numbers on inverter screen vs expected kwH.", type: "Textarea", required: true },
                { label: "Clean up all zip tie tails, MC4 caps, and cardboard.", type: "PassFail", required: true },
                { label: "Download monitoring app onto client phone and sync the gateway.", type: "PassFail", required: true },
                { label: "Educate client on rapid shutdown switch in case of emergency.", type: "PassFail", required: true },
                { label: "Provide completed serial number map and warranties.", type: "PassFail", required: true },
                { label: "Photo of energized inverter with green production light.", type: "Photo", required: true }
            ]
        }
    ],
    Security: [
        {
            name: "Security - Threat Vectoring & Placement",
            items: [
                { label: "Review property blueprints or perform walk to identify primary breach points.", type: "Textarea", required: true },
                { label: "Map camera FOVs (Field of View) avoiding heavy blinding sun flare.", type: "PassFail", required: true },
                { label: "Identify low-voltage power sourcing and NVR placement.", type: "PassFail", required: true },
                { label: "Conceal all cabling to prevent easy tampering or snipping by intruders.", type: "PassFail", required: true },
                { label: "Perform test-fit of door/window contact sensors assessing gap distance.", type: "PassFail", required: true },
                { label: "Measure network signal strength at proposed WiFi camera locations.", type: "Text", required: true },
                { label: "Take pre-install photos of main mounting walls and eaves.", type: "Photo", required: true }
            ]
        },
        {
            name: "Security - System Hardening & Calibration",
            items: [
                { label: "Update all cameras, sensors, and the main NVR to latest secure firmware.", type: "PassFail", required: true },
                { label: "Change default administrator passwords to complex physical credentials.", type: "PassFail", required: true },
                { label: "Aim and focus all camera lenses; wipe outer glass to prevent IR reflection.", type: "PassFail", required: true },
                { label: "Adjust motion detection zones to ignore high traffic public sidewalks/trees.", type: "Textarea", required: true },
                { label: "Test panic buttons and verify command center dispatch signal.", type: "PassFail", required: true },
                { label: "Clean up drywall dust and packaging from all room sensors.", type: "PassFail", required: true },
                { label: "Guide client in setting up geofencing on their mobile app.", type: "PassFail", required: true },
                { label: "Verify 30-day loop recording functionality is activated.", type: "PassFail", required: true },
                { label: "Screenshot photo of the multi-feed camera display running perfectly.", type: "Photo", required: true }
            ]
        }
    ],
    "Pet Grooming": [
        {
            name: "Pet Grooming - Health Assessment & Intake",
            items: [
                { label: "Confirm exact cut, style, and length preferences with the owner.", type: "Textarea", required: true },
                { label: "Physically inspect animal's skin for tumors, warts, ticks, or hotspots.", type: "PassFail", required: true },
                { label: "Assess animal temperament and apply appropriate muzzling if required.", type: "PassFail", required: true },
                { label: "Verify vaccination records (Rabies/Bordetella) are up to date.", type: "PassFail", required: true },
                { label: "Check condition of nails, ears, and teeth.", type: "Textarea", required: true },
                { label: "Securely tether the pet in the washing station/tub.", type: "PassFail", required: true },
                { label: "Test the water temperature on wrist before beginning wash.", type: "PassFail", required: true },
                { label: "Take a 'Before' photo for the client profile.", type: "Photo", required: true }
            ]
        },
        {
            name: "Pet Grooming - Detailing & Salon Sanitization",
            items: [
                { label: "Trim nails safely, ensuring styptic powder is on standby.", type: "PassFail", required: true },
                { label: "Clean ears with approved solution and gently pluck excess hair.", type: "PassFail", required: true },
                { label: "Ensure full brush-out, verifying zero extreme matting against the skin.", type: "PassFail", required: true },
                { label: "Apply client-agreed colognes, bandanas, or bows.", type: "PassFail", required: false },
                { label: "Take an 'After' showcase photo for the owner and social media.", type: "Photo", required: true },
                { label: "Disinfect clippers and shears using Barbicide or UV sterilizer.", type: "PassFail", required: true },
                { label: "Thoroughly scrub and sanitize the tub and grooming table.", type: "PassFail", required: true },
                { label: "Sweep and discard all fur clippings following bio-regulations.", type: "PassFail", required: true },
                { label: "Notate any behavioral or physical issues in the client CRM.", type: "Textarea", required: true },
                { label: "Walk owner through after-care brushing advice.", type: "PassFail", required: true }
            ]
        }
    ]
};
