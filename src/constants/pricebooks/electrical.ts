import { ProposalPreset } from 'types';

export const ELECTRICAL_MASTER_BOOK: Omit<ProposalPreset, 'id' | 'organizationId'>[] = [
    // 1. DIAGNOSTICS & FAULT FINDING
    { name: 'Electrical Diagnostic - Level 1', description: 'Standard troubleshooting for single circuit failure or minor device issues during business hours.', baseCost: 0, avgLabor: 1, category: 'Diagnostics' },
    { name: 'Electrical Diagnostic - Level 2', description: 'Comprehensive troubleshooting for intermittent faults, partial power loss, or multi-circuit issues.', baseCost: 0, avgLabor: 2, category: 'Diagnostics' },
    { name: 'Emergency Diagnostic - After Hours', description: 'Priority dispatch for immediate electrical hazards or total power loss outside standard hours.', baseCost: 0, avgLabor: 1.5, category: 'Diagnostics' },
    { name: 'Thermal Imaging Inspection', description: 'Infrared scan of electrical panels and connections to identify hot spots and loose terminations.', baseCost: 0, avgLabor: 1.25, category: 'Diagnostics' },
    { name: 'Power Quality Analysis', description: 'Measurement of voltage sags, surges, and harmonic distortion at the main service.', baseCost: 45, avgLabor: 2, category: 'Diagnostics' },
    { name: 'Circuit Tracing & Mapping', description: 'Identify and label all outlets and fixtures on a specific circuit or whole panel.', baseCost: 5, avgLabor: 1.5, category: 'Diagnostics' },
    { name: 'Grounding Resistance Test', description: 'Measure the effectiveness of the home grounding electrode system.', baseCost: 0, avgLabor: 1, category: 'Diagnostics' },
    { name: 'Megohmmeter Insulation Test', description: 'Test wire insulation integrity for damaged or aging conductors.', baseCost: 0, avgLabor: 1.5, category: 'Diagnostics' },

    // 2. PANEL & SERVICE COMPONENTS
    { name: 'Main Circuit Breaker - 100/200 Amp', description: 'Replacement of failed main disconnect breaker in panel.', baseCost: 110, avgLabor: 2.5, category: 'Electrical' },
    { name: 'Circuit Breaker - Single Pole (15-20A)', description: 'Replace standard branch circuit breaker.', baseCost: 12, avgLabor: 0.75, category: 'Electrical' },
    { name: 'Circuit Breaker - Double Pole (30-50A)', description: 'Replace 240V branch circuit breaker for heavy appliances.', baseCost: 28, avgLabor: 1, category: 'Electrical' },
    { name: 'Circuit Breaker - AFCI (Arc Fault)', description: 'Replace or upgrade to safety arc-fault protected breaker.', baseCost: 55, avgLabor: 1, category: 'Electrical' },
    { name: 'Circuit Breaker - GFCI (Ground Fault)', description: 'Replace or upgrade to ground-fault protected breaker.', baseCost: 65, avgLabor: 1, category: 'Electrical' },
    { name: 'Circuit Breaker - Tandem/Space Saver', description: 'Install dual circuit breaker in a single panel slot.', baseCost: 22, avgLabor: 0.75, category: 'Electrical' },
    { name: 'Panel Rejuvenation Package', description: 'Clean bus bars, tighten all terminations, and balance phases.', baseCost: 15, avgLabor: 2, category: 'Maintenance' },
    { name: 'Whole House Surge Protector (Type 2)', description: 'Supply and install panel-mounted surge suppression device.', baseCost: 185, avgLabor: 1.5, category: 'Electrical' },
    { name: 'Bus Bar Repair / Replacement', description: 'Specialized repair of damaged panel bus connection points.', baseCost: 85, avgLabor: 3, category: 'Electrical' },
    { name: 'Sub-Panel Installation - 60 Amp', description: 'Supply and install secondary distribution panel (Excludes feeder).', baseCost: 150, avgLabor: 4, category: 'Electrical' },

    // 3. OUTLETS & RECEPTACLES
    { name: 'Standard Outlet Replacement', description: 'Replace worn 15A/20A duplex receptacle with new device and cover.', baseCost: 3, avgLabor: 0.5, category: 'Electrical' },
    { name: 'GFCI Outlet - Kitchen/Bath (20A)', description: 'Install safety ground-fault protected receptacle.', baseCost: 25, avgLabor: 0.75, category: 'Electrical' },
    { name: 'USB Charger Outlet Upgrade', description: 'Install high-speed USB-A/C integrated charging outlet.', baseCost: 35, avgLabor: 0.75, category: 'Electrical' },
    { name: 'Tamper Resistant (TR) Outlet Upgrade', description: 'Upgrade devices to current safety code for child protection.', baseCost: 5, avgLabor: 0.5, category: 'Electrical' },
    { name: 'Weather-Resistant (WR) GFCI', description: 'Install outdoor rated safety receptacle in weatherproof box.', baseCost: 45, avgLabor: 1, category: 'Electrical' },
    { name: 'Recessed Outlet (Clock/TV)', description: 'Install inset outlet for flush-mounting electronics.', baseCost: 18, avgLabor: 1, category: 'Electrical' },
    { name: 'Floor Outlet Installation', description: 'Cut into floor and install brass/nickel pop-up receptacle.', baseCost: 85, avgLabor: 3, category: 'Electrical' },
    { name: 'Loose Termination Repair', description: 'Locate and tighten loose wire connections causing heat or arcing.', baseCost: 2, avgLabor: 1, category: 'Electrical' },

    // 4. SWITCHES & DIMMERS
    { name: 'Standard Toggle Switch', description: 'Replace basic single-pole wall switch.', baseCost: 2, avgLabor: 0.5, category: 'Electrical' },
    { name: '3-Way Switch Replacement', description: 'Replace one of two switches controlling a single light.', baseCost: 5, avgLabor: 0.75, category: 'Electrical' },
    { name: '4-Way Switch Replacement', description: 'Replace intermediate switch in multi-location control.', baseCost: 12, avgLabor: 1, category: 'Electrical' },
    { name: 'LED Dimmer - Slider/Rocker', description: 'Install flicker-free dimmer rated for LED bulbs.', baseCost: 28, avgLabor: 0.75, category: 'Electrical' },
    { name: 'Motion Sensor Switch (Occupancy)', description: 'Install auto-on/off sensor for closets, baths, or garages.', baseCost: 35, avgLabor: 1, category: 'Electrical' },
    { name: 'Smart Switch - Wi-Fi/Zigbee', description: 'Install smart home lighting control (Requires Neutral).', baseCost: 65, avgLabor: 1, category: 'Accessories' },
    { name: 'Programmable Timer Switch', description: 'Digital timer for exhaust fans or exterior lights.', baseCost: 45, avgLabor: 1, category: 'Electrical' },
    { name: 'Stacked Switch (2-in-1)', description: 'Replace dual switches in a single gang box.', baseCost: 18, avgLabor: 0.75, category: 'Electrical' },

    // 5. INTERIOR LIGHTING
    { name: 'Recessed Can Light (6" LED)', description: 'Install new construction or remodel wafer/can housing.', baseCost: 35, avgLabor: 2, category: 'Electrical' },
    { name: 'Ceiling Fan Installation (Up to 12ft)', description: 'Assemble and hang customer provided fan on existing box.', baseCost: 0, avgLabor: 1.5, category: 'Electrical' },
    { name: 'Ceiling Fan - Heavy Duty Bracing', description: 'Replace standard box with fan-rated brace and box.', baseCost: 25, avgLabor: 1, category: 'Electrical' },
    { name: 'Chandelier - Standard (Under 20 lbs)', description: 'Install dining or entryway decorative fixture.', baseCost: 0, avgLabor: 2, category: 'Electrical' },
    { name: 'Chandelier - Large (Over 20 lbs)', description: 'Heavy fixture install requiring specialized mounting/winch.', baseCost: 85, avgLabor: 4, category: 'Electrical' },
    { name: 'Under-Cabinet LED Strip (Per FT)', description: 'Low-voltage or direct wire task lighting installation.', baseCost: 15, avgLabor: 0.5, category: 'Electrical' },
    { name: 'Vanity Light Bar Replacement', description: 'Replace bathroom light fixture over mirror.', baseCost: 0, avgLabor: 1.25, category: 'Electrical' },
    { name: 'Track Lighting System (4-8ft)', description: 'Install track and individual directional heads.', baseCost: 85, avgLabor: 2.5, category: 'Electrical' },

    // 6. EXTERIOR LIGHTING & POWER
    { name: 'Flood Light - Twin Head', description: 'Install or replace exterior security flood fixture.', baseCost: 45, avgLabor: 1.5, category: 'Electrical' },
    { name: 'Motion Activated Flood Light', description: 'Install premium security sensor light.', baseCost: 75, avgLabor: 1.75, category: 'Electrical' },
    { name: 'Landscape Lighting Transformer (300W)', description: 'Install low-voltage controller and timer.', baseCost: 220, avgLabor: 2, category: 'Electrical' },
    { name: 'Pathway Light (Per Fixture)', description: 'Install and wire low-voltage landscape light.', baseCost: 45, avgLabor: 0.5, category: 'Electrical' },
    { name: 'Dusk-to-Dawn Photo Cell', description: 'Add automatic light sensor for outdoor lighting.', baseCost: 18, avgLabor: 1, category: 'Electrical' },
    { name: 'GFCI In-Use Weatherproof Cover', description: 'Replace "bubble" cover for code-compliant outdoor power.', baseCost: 15, avgLabor: 0.5, category: 'Electrical' },
    { name: 'Post Light Installation', description: 'Install yard light on top of 3" pole.', baseCost: 65, avgLabor: 2, category: 'Electrical' },

    // 7. HEAVY CIRCUITS & APPLIANCES
    { name: 'EV Charger Circuit (50 Amp)', description: 'NEMA 14-50 outlet for electric vehicle (Up to 50ft).', baseCost: 450, avgLabor: 5, category: 'Electrical' },
    { name: 'Electric Range / Oven Circuit', description: 'New 40A/50A 240V dedicated appliance circuit.', baseCost: 280, avgLabor: 4, category: 'Electrical' },
    { name: 'Electric Dryer Circuit', description: 'New 30A 240V dedicated appliance circuit.', baseCost: 185, avgLabor: 3.5, category: 'Electrical' },
    { name: 'AC Condenser Dedicated Circuit', description: 'New 30A-50A circuit for HVAC equipment.', baseCost: 220, avgLabor: 3, category: 'Electrical' },
    { name: 'Hot Tub / Spa Disconnect (60A)', description: 'Install GFCI protected exterior disconnect box.', baseCost: 350, avgLabor: 6, category: 'Electrical' },
    { name: 'Water Heater Power Connection', description: 'Connect 240V service to electric water tank.', baseCost: 15, avgLabor: 1.5, category: 'Electrical' },
    { name: 'Garbage Disposal Power Outfeed', description: 'Install under-sink outlet and switch control.', baseCost: 35, avgLabor: 2.5, category: 'Electrical' },

    // 8. SAFETY & CODE COMPLIANCE
    { name: 'Smoke Detector - Battery (10yr)', description: 'Install standalone lithium battery detector.', baseCost: 32, avgLabor: 0.5, category: 'Electrical' },
    { name: 'Smoke/CO Combo - Hardwired', description: 'Install interconnected safety alarm with backup battery.', baseCost: 65, avgLabor: 0.75, category: 'Electrical' },
    { name: 'Whole House Smoke Audit', description: 'Inspect and test all alarms; replace batteries platform-wide.', baseCost: 15, avgLabor: 1.5, category: 'Maintenance' },
    { name: 'Ground Rod Installation (8ft)', description: 'Drive and bond copper-clad ground rod.', baseCost: 45, avgLabor: 2, category: 'Electrical' },
    { name: 'Main Water Meter Bonding', description: 'Install jumper wire around water meter for electrical ground.', baseCost: 15, avgLabor: 1, category: 'Electrical' },
    { name: 'CSST Gas Line Bonding', description: 'Install required safety bonding for flexible gas piping.', baseCost: 22, avgLabor: 1.5, category: 'Electrical' },
    { name: 'Safety Inspection Report', description: 'Comprehensive checklist of panel, devices, and grounding.', baseCost: 0, avgLabor: 1.5, category: 'Diagnostics' },

    // 9. SMART HOME & ACCESSORIES
    { name: 'Ring/Nest Doorbell Installation', description: 'Mount and connect smart video doorbell.', baseCost: 0, avgLabor: 1, category: 'Accessories' },
    { name: 'Doorbell Transformer Upgrade', description: 'Replace low voltage transformer for smart cams.', baseCost: 28, avgLabor: 1, category: 'Electrical' },
    { name: 'Smart Hub Configuration', description: 'Sync and program smart devices to mobile app.', baseCost: 0, avgLabor: 1.5, category: 'Accessories' },
    { name: 'Security Camera - Exterior PoE', description: 'Mount and wire network-based security camera.', baseCost: 120, avgLabor: 3, category: 'Accessories' },
    { name: 'Data Port - RJ45 Cat6', description: 'Pull cable and terminate network wall jack.', baseCost: 35, avgLabor: 2, category: 'Electrical' },

    // 10. GENERATORS & SPECIALTY
    { name: 'Generator Interlock Kit', description: 'Safe mechanical lockout for portable generator input.', baseCost: 145, avgLabor: 3, category: 'Electrical' },
    { name: 'Transfer Switch - 6 Circuit', description: 'Install manual sub-panel for emergency backup.', baseCost: 385, avgLabor: 5, category: 'Electrical' },
    { name: 'Generator Inlet Box (30A/50A)', description: 'Install exterior power input for portable gen.', baseCost: 85, avgLabor: 2.5, category: 'Electrical' },
    { name: 'Attic Exhaust Fan Installation', description: 'Mount and wire temperature-controlled vent fan.', baseCost: 165, avgLabor: 3, category: 'Electrical' },
    { name: 'Bathroom Exhaust Fan - Replacement', description: 'Swap failed ceiling vent fan unit.', baseCost: 85, avgLabor: 2, category: 'Electrical' },
];
