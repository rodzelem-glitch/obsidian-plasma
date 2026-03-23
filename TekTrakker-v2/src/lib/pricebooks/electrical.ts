
import { ProposalPreset } from '@types';

export const ELECTRICAL_MASTER_BOOK: Omit<ProposalPreset, 'id' | 'organizationId'>[] = [
    // --- 1. DIAGNOSTICS & TROUBLESHOOTING ---
    { name: 'Electrical Diagnostic - Level 1 (Standard)', description: 'Standard troubleshooting for single circuit failure, tripping breaker, or minor device issue during business hours.', baseCost: 0, avgLabor: 1.0, category: 'Diagnostics' },
    { name: 'Electrical Diagnostic - Level 2 (Advanced)', description: 'Comprehensive troubleshooting for intermittent faults, partial power loss, multi-circuit issues, or flickering lights.', baseCost: 0, avgLabor: 2.0, category: 'Diagnostics' },
    { name: 'Electrical Diagnostic - Level 3 (Whole Home/Complex)', description: 'Extensive tracing for grounding issues, lightning damage assessment, or older wiring systems (Knob & Tube/Aluminum).', baseCost: 0, avgLabor: 3.5, category: 'Diagnostics' },
    { name: 'Emergency Diagnostic - After Hours', description: 'Priority dispatch for immediate electrical hazards, burning smells, or total power loss outside standard hours.', baseCost: 0, avgLabor: 1.5, category: 'Diagnostics' },
    { name: 'Thermal Imaging Inspection (Panel)', description: 'Infrared scan of main panel and sub-panels to identify hot spots, loose connections, and overloaded breakers.', baseCost: 0, avgLabor: 1.0, category: 'Diagnostics' },
    { name: 'Power Quality Analysis', description: 'Install logging meter to measure voltage sags, surges, and harmonic distortion over 24-48 hours.', baseCost: 45, avgLabor: 2.0, category: 'Diagnostics' },
    { name: 'Circuit Tracing & Mapping (Per Panel)', description: 'Identify and label all breakers in a standard residential panel.', baseCost: 5, avgLabor: 2.5, category: 'Diagnostics' },
    { name: 'Megohmmeter Insulation Test', description: 'Test wire insulation integrity to detect damage or aging conductors underground or in walls.', baseCost: 0, avgLabor: 1.5, category: 'Diagnostics' },
    { name: 'Grounding System Test (3-Point)', description: 'Measure earth ground resistance to ensure effective grounding electrode system.', baseCost: 0, avgLabor: 1.25, category: 'Diagnostics' },

    // --- 2. SERVICE & PANEL UPGRADES ---
    { name: 'Main Panel Upgrade - 100A to 200A', description: 'Replace existing 100A service with new 200A panel, meter socket, riser, and grounding. Includes permit fees.', baseCost: 850, avgLabor: 10.0, category: 'Electrical' },
    { name: 'Main Panel Swap - 200A (Same Ampacity)', description: 'Replace outdated or recalled panel (Federal Pacific/Zinsco) with new 200A panel and breakers.', baseCost: 650, avgLabor: 8.0, category: 'Electrical' },
    { name: 'Sub-Panel Installation - 60 Amp', description: 'Supply and install secondary distribution panel (Main Lug) with feeder wire (up to 20ft).', baseCost: 250, avgLabor: 5.0, category: 'Electrical' },
    { name: 'Sub-Panel Installation - 100 Amp', description: 'Supply and install 100A sub-panel with feeder wire (up to 20ft).', baseCost: 350, avgLabor: 6.0, category: 'Electrical' },
    { name: 'Meter Socket Replacement - 200A', description: 'Replace damaged or corroded meter base enclosure (Overhead service).', baseCost: 280, avgLabor: 4.0, category: 'Electrical' },
    { name: 'Service Riser / Mast Repair', description: 'Repair or replace damaged service entrance conduit and weatherhead.', baseCost: 150, avgLabor: 3.5, category: 'Electrical' },
    { name: 'Grounding System Upgrade', description: 'Install two ground rods (8ft), bond water pipe, and verify intersystem bonding bridge.', baseCost: 85, avgLabor: 3.0, category: 'Electrical' },
    { name: 'Whole House Surge Protector (Type 1/2)', description: 'Supply and install panel-mounted surge suppression device (50kA+ rating).', baseCost: 185, avgLabor: 1.0, category: 'Electrical' },
    { name: 'Main Breaker Replacement - 200A', description: 'Replace failed main disconnect breaker in panel.', baseCost: 180, avgLabor: 1.5, category: 'Electrical' },
    { name: 'Bus Bar Repair / Refurbishment', description: 'Clean and polish bus bars, apply anti-oxidant, and retorque all connections.', baseCost: 25, avgLabor: 2.0, category: 'Maintenance' },

    // --- 3. CIRCUIT BREAKERS & FUSES ---
    { name: 'Circuit Breaker - Single Pole (15-20A)', description: 'Replace standard branch circuit breaker.', baseCost: 12, avgLabor: 0.5, category: 'Electrical' },
    { name: 'Circuit Breaker - Double Pole (30-50A)', description: 'Replace 240V branch circuit breaker (Dryer/AC/Range).', baseCost: 28, avgLabor: 0.75, category: 'Electrical' },
    { name: 'Circuit Breaker - AFCI (Arc Fault)', description: 'Install arc-fault protection breaker for bedrooms/living areas.', baseCost: 65, avgLabor: 0.75, category: 'Electrical' },
    { name: 'Circuit Breaker - GFCI (Ground Fault)', description: 'Install ground-fault protection breaker for wet locations.', baseCost: 75, avgLabor: 0.75, category: 'Electrical' },
    { name: 'Circuit Breaker - Dual Function (AFCI/GFCI)', description: 'Install combination AFCI/GFCI breaker.', baseCost: 85, avgLabor: 0.75, category: 'Electrical' },
    { name: 'Circuit Breaker - Tandem / Quad', description: 'Install space-saving breaker to create room in full panel.', baseCost: 25, avgLabor: 0.75, category: 'Electrical' },

    // --- 4. DEDICATED CIRCUITS (New Runs) ---
    { name: 'Dedicated Circuit - 15/20A (120V)', description: 'Run new line for microwave, fridge, or sump pump (up to 50ft, accessible).', baseCost: 65, avgLabor: 3.0, category: 'Electrical' },
    { name: 'EV Charger Circuit - 50 Amp (NEMA 14-50)', description: 'Install 240V circuit for electric vehicle charger (up to 30ft from panel).', baseCost: 220, avgLabor: 4.0, category: 'Electrical' },
    { name: 'Hardwired EV Station Installation', description: 'Mount and wire wall connector (Tesla/ChargePoint) to new 60A circuit.', baseCost: 250, avgLabor: 5.0, category: 'Electrical' },
    { name: 'Electric Range / Oven Circuit (50A)', description: 'Install 240V range receptacle and wiring (up to 40ft).', baseCost: 180, avgLabor: 4.0, category: 'Electrical' },
    { name: 'Electric Dryer Circuit (30A)', description: 'Install 240V dryer receptacle (4-wire) and wiring (up to 40ft).', baseCost: 140, avgLabor: 3.5, category: 'Electrical' },
    { name: 'AC Condenser Circuit (30-40A)', description: 'Run new outdoor power circuit for HVAC unit including disconnect.', baseCost: 160, avgLabor: 3.5, category: 'Electrical' },
    { name: 'Hot Tub Circuit (50-60A)', description: 'Install GFCI spa panel and wiring to hot tub location (up to 50ft).', baseCost: 450, avgLabor: 6.0, category: 'Electrical' },
    { name: 'Dedicated Computer / Server Circuit', description: 'Run isolated ground circuit for sensitive electronics.', baseCost: 95, avgLabor: 3.5, category: 'Electrical' },

    // --- 5. OUTLETS & RECEPTACLES ---
    { name: 'Standard Outlet Replacement (Duplex)', description: 'Replace worn 15A/20A receptacle with commercial grade device.', baseCost: 5, avgLabor: 0.35, category: 'Electrical' },
    { name: 'GFCI Outlet Installation (15/20A)', description: 'Install GFCI receptacle in kitchen, bath, or garage.', baseCost: 28, avgLabor: 0.5, category: 'Electrical' },
    { name: 'USB Charging Outlet Upgrade', description: 'Install outlet with integrated USB-A and USB-C ports.', baseCost: 35, avgLabor: 0.5, category: 'Electrical' },
    { name: 'Weather Resistant Outdoor Outlet', description: 'Install WR-rated GFCI with "In-Use" weatherproof cover.', baseCost: 45, avgLabor: 0.75, category: 'Electrical' },
    { name: 'Floor Outlet Installation (Brass)', description: 'Cut into wood floor/subfloor and install brass pop-up box.', baseCost: 120, avgLabor: 3.0, category: 'Electrical' },
    { name: 'Recessed Outlet (Behind TV)', description: 'Install recessed box for flat screen mounting.', baseCost: 22, avgLabor: 0.75, category: 'Electrical' },
    { name: 'Dryer Outlet Conversion (3 to 4 Prong)', description: 'Update dryer receptacle and cord to modern 4-wire standard.', baseCost: 45, avgLabor: 1.0, category: 'Electrical' },
    { name: 'New Outlet - Fish Wall (Standard)', description: 'Cut in new box and fish wire from nearby source (same stud bay).', baseCost: 15, avgLabor: 1.5, category: 'Electrical' },

    // --- 6. SWITCHES, DIMMERS & CONTROLS ---
    { name: 'Standard Switch Replacement', description: 'Replace single pole toggle or rocker switch.', baseCost: 4, avgLabor: 0.35, category: 'Electrical' },
    { name: 'Dimmer Switch Installation', description: 'Install LED-compatible dimmer slider/rocker.', baseCost: 32, avgLabor: 0.5, category: 'Electrical' },
    { name: '3-Way Switch Installation (Pair)', description: 'Replace switches at both ends of a hallway/staircase.', baseCost: 12, avgLabor: 0.75, category: 'Electrical' },
    { name: 'Motion Sensor Switch (Occupancy)', description: 'Install auto-on/off sensor for laundry, garage, or pantry.', baseCost: 38, avgLabor: 0.5, category: 'Electrical' },
    { name: 'Smart Switch (Wi-Fi)', description: 'Install smart switch (Lutron/Leviton). Requires neutral wire check.', baseCost: 55, avgLabor: 0.75, category: 'Electrical' },
    { name: 'Timer Switch (Fan/Exterior)', description: 'Install programmable timer for exhaust fan or porch lights.', baseCost: 45, avgLabor: 0.75, category: 'Electrical' },
    { name: 'Photocell Installation', description: 'Install dusk-to-dawn sensor for outdoor lighting.', baseCost: 25, avgLabor: 1.0, category: 'Electrical' },

    // --- 7. INDOOR LIGHTING ---
    { name: 'Ceiling Fan Installation (Standard)', description: 'Assemble and hang customer-provided fan on existing fan-rated box.', baseCost: 5, avgLabor: 1.5, category: 'Electrical' },
    { name: 'Ceiling Fan - New Box & Brace', description: 'Cut ceiling and install heavy-duty fan brace and box.', baseCost: 65, avgLabor: 2.5, category: 'Electrical' },
    { name: 'Recessed Light - New Install (LED Wafer)', description: 'Cut, wire, and install ultra-thin LED recessed light (Per light).', baseCost: 35, avgLabor: 1.25, category: 'Electrical' },
    { name: 'Recessed Light - Retrofit Trim', description: 'Convert existing can light to integrated LED trim.', baseCost: 20, avgLabor: 0.25, category: 'Electrical' },
    { name: 'Chandelier Installation - Standard', description: 'Install dining/foyer fixture up to 12ft ceiling.', baseCost: 10, avgLabor: 2.0, category: 'Electrical' },
    { name: 'Chandelier Installation - High Ceiling', description: 'Install fixture on 12ft+ ceiling (Requires scaffold/lift).', baseCost: 25, avgLabor: 4.0, category: 'Electrical' },
    { name: 'Chandelier Lift Installation', description: 'Install motorized winch for lowering high chandeliers.', baseCost: 350, avgLabor: 6.0, category: 'Electrical' },
    { name: 'Under Cabinet Lighting (LED Strip)', description: 'Install hardwired LED tape light and driver under kitchen cabinets.', baseCost: 85, avgLabor: 3.0, category: 'Electrical' },
    { name: 'Vanity Light Replacement', description: 'Remove old and install new bathroom vanity bar light.', baseCost: 5, avgLabor: 1.0, category: 'Electrical' },
    { name: 'Track Lighting Installation', description: 'Install 4-8ft track and adjust heads.', baseCost: 85, avgLabor: 2.0, category: 'Electrical' },

    // --- 8. OUTDOOR & LANDSCAPE LIGHTING ---
    { name: 'Flood Light - Twin Head LED', description: 'Install new exterior security flood light.', baseCost: 55, avgLabor: 1.5, category: 'Electrical' },
    { name: 'Motion Sensing Security Light', description: 'Install flood light with PIR motion sensor.', baseCost: 75, avgLabor: 1.5, category: 'Electrical' },
    { name: 'Landscape Transformer (300W)', description: 'Install low-voltage transformer and timer.', baseCost: 220, avgLabor: 2.0, category: 'Electrical' },
    { name: 'Landscape Path Light (Per Fixture)', description: 'Wire and stake low voltage path light.', baseCost: 45, avgLabor: 0.5, category: 'Electrical' },
    { name: 'Landscape Spot/Well Light', description: 'Wire and bury up-light for tree/facade accent.', baseCost: 65, avgLabor: 0.75, category: 'Electrical' },
    { name: 'Post Light Installation', description: 'Install lamp post light (wiring to base included).', baseCost: 120, avgLabor: 3.0, category: 'Electrical' },
    { name: 'Soffit/Eave Downlighting (Per Light)', description: 'Install recessed LED puck light in exterior soffit.', baseCost: 45, avgLabor: 1.5, category: 'Electrical' },

    // --- 9. SAFETY & DETECTORS ---
    { name: 'Smoke Detector - Hardwired (Replace)', description: 'Replace existing 120V smoke alarm.', baseCost: 35, avgLabor: 0.5, category: 'Electrical' },
    { name: 'Smoke/CO Combo - Hardwired', description: 'Install interconnected Smoke and Carbon Monoxide detector.', baseCost: 65, avgLabor: 0.5, category: 'Electrical' },
    { name: 'Smoke Detector - New Cut-in', description: 'Fish wire and install new hardwired smoke box.', baseCost: 45, avgLabor: 1.5, category: 'Electrical' },
    { name: 'Whole House Smoke Audit', description: 'Test all alarms, replace batteries, check expiration dates.', baseCost: 35, avgLabor: 1.5, category: 'Maintenance' },
    { name: 'Surge Protection - Device Level', description: 'Install surge receptacle for sensitive entertainment center.', baseCost: 45, avgLabor: 0.5, category: 'Electrical' },
    { name: 'Child Safety Audit', description: 'Check all accessible outlets and install TR devices where needed.', baseCost: 0, avgLabor: 1.0, category: 'Diagnostics' },

    // --- 10. GENERATORS & BACKUP POWER ---
    { name: 'Generator Interlock Kit Installation', description: 'Install mechanical interlock and breaker for portable generator backfeed.', baseCost: 145, avgLabor: 3.0, category: 'Electrical' },
    { name: 'Generator Inlet Box (30A)', description: 'Install exterior L14-30 inlet box and wire to panel.', baseCost: 85, avgLabor: 2.5, category: 'Electrical' },
    { name: 'Generator Inlet Box (50A)', description: 'Install exterior CS6375 inlet box and wire to panel.', baseCost: 125, avgLabor: 3.0, category: 'Electrical' },
    { name: 'Manual Transfer Switch (6-10 Circuit)', description: 'Install pre-wired transfer switch for critical loads.', baseCost: 350, avgLabor: 6.0, category: 'Electrical' },
    { name: 'Whole Home Generator (Standby) - Electrical', description: 'Electrical hookup for standby generator (Gas/Plumbing separate).', baseCost: 450, avgLabor: 12.0, category: 'Electrical' },
    { name: 'Battery Backup System (Powerwall)', description: 'Install battery storage inverter and gateway (Labor estimate).', baseCost: 250, avgLabor: 16.0, category: 'Electrical' },

    // --- 11. LOW VOLTAGE & DATA ---
    { name: 'Data Drop - Cat6 Ethernet', description: 'Run Cat6 cable and terminate wall jack (up to 75ft).', baseCost: 45, avgLabor: 2.0, category: 'Electrical' },
    { name: 'Coax Cable Run (TV/Internet)', description: 'Run RG6 coaxial cable and terminate.', baseCost: 35, avgLabor: 1.5, category: 'Electrical' },
    { name: 'Video Doorbell Install (Ring/Nest)', description: 'Mount doorbell and connect to existing chime transformer.', baseCost: 10, avgLabor: 1.0, category: 'Accessories' },
    { name: 'Doorbell Transformer Upgrade', description: 'Replace underpowered transformer for smart doorbells.', baseCost: 28, avgLabor: 1.0, category: 'Electrical' },
    { name: 'Security Camera Install (PoE)', description: 'Mount and wire Power-over-Ethernet camera.', baseCost: 25, avgLabor: 2.5, category: 'Accessories' },
    { name: 'Flat Screen TV Mounting (w/ Concealed Power)', description: 'Mount TV and install recessed power outlet behind it.', baseCost: 55, avgLabor: 2.5, category: 'Accessories' },

    // --- 12. MISCELLANEOUS & REPAIR ---
    { name: 'Attic Exhaust Fan Installation', description: 'Install gable or roof mount attic ventilator with thermostat.', baseCost: 165, avgLabor: 3.0, category: 'Electrical' },
    { name: 'Bathroom Exhaust Fan Replacement', description: 'Replace noisy bathroom fan motor/housing.', baseCost: 95, avgLabor: 2.0, category: 'Electrical' },
    { name: 'Short Circuit Repair', description: 'Locate and repair short in wall or junction box.', baseCost: 10, avgLabor: 2.5, category: 'Electrical' },
    { name: 'Aluminum Wiring Remediation (Per Device)', description: 'Install Alumiconn connectors to pig-tail copper to aluminum wire.', baseCost: 8, avgLabor: 0.4, category: 'Electrical' },
    { name: 'Knob & Tube Decommissioning', description: 'Locate and disconnect active K&T wiring (Per Room).', baseCost: 15, avgLabor: 4.0, category: 'Electrical' },
];
