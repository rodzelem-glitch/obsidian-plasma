
import { ProposalPreset } from '@types';

export const TELECOMMUNICATIONS_MASTER_BOOK: Omit<ProposalPreset, 'id' | 'organizationId'>[] = [
    // --- 1. DIAGNOSTICS & TESTING ---
    { name: 'Network Diagnostic - Level 1 (Connectivity)', description: 'Troubleshoot single workstation connection or Wi-Fi dead zone.', baseCost: 0, avgLabor: 1.0, category: 'Diagnostics' },
    { name: 'Network Diagnostic - Level 2 (Infrastructure)', description: 'Tracing cables, toning lines, and identifying unlabeled patch panel ports.', baseCost: 0, avgLabor: 2.0, category: 'Diagnostics' },
    { name: 'Fiber Optic Diagnostic (OTDR)', description: 'Optical Time-Domain Reflectometer testing to locate fiber breaks or signal loss.', baseCost: 25, avgLabor: 2.5, category: 'Diagnostics' },
    { name: 'Wi-Fi Site Survey - Heatmap', description: 'RF spectrum analysis and coverage mapping for facility.', baseCost: 0, avgLabor: 3.0, category: 'Diagnostics' },
    { name: 'Cable Certification Test (Per Link)', description: 'Certify Cat6/6A run to TIA standards with printout report.', baseCost: 0, avgLabor: 0.25, category: 'Diagnostics' },
    { name: 'Phone System Diagnostic (VoIP/Analog)', description: 'Troubleshoot dial tone, jitter, or handset connectivity.', baseCost: 0, avgLabor: 1.5, category: 'Diagnostics' },
    { name: 'CCTV / Security Camera Diagnostic', description: 'Troubleshoot offline cameras, NVR recording issues, or power loss.', baseCost: 0, avgLabor: 1.5, category: 'Diagnostics' },

    // --- 2. STRUCTURED CABLING (COPPER) ---
    { name: 'Cat6 Data Drop - Standard (Plenum)', description: 'Install single Cat6 plenum cable, jack, faceplate, and patch panel termination (up to 150ft).', baseCost: 45, avgLabor: 1.5, category: 'Cabling' },
    { name: 'Cat6 Data Drop - Difficult Access', description: 'Installation requiring lift, conduit work, or hard lid ceiling fishing.', baseCost: 55, avgLabor: 2.5, category: 'Cabling' },
    { name: 'Cat6A Data Drop - 10Gig (Plenum)', description: 'Install shielded Cat6A for high-speed uplinks or WAPs.', baseCost: 75, avgLabor: 2.0, category: 'Cabling' },
    { name: 'Dual Cat6 Drop (Voice/Data)', description: 'Two cables to single location with dual-port faceplate.', baseCost: 85, avgLabor: 2.25, category: 'Cabling' },
    { name: 'Coax Cable Run (RG6 Quad)', description: 'Install RG6 coaxial cable for TV or Cable Modem.', baseCost: 35, avgLabor: 1.25, category: 'Cabling' },
    { name: 'Paging / Speaker Wire Run', description: 'Install 16/2 or 18/2 shielded audio cable for overhead paging.', baseCost: 25, avgLabor: 1.0, category: 'Cabling' },
    { name: 'Demarc Extension (T1/DSL/POTS)', description: 'Extend service provider circuit from MPOE to server room.', baseCost: 45, avgLabor: 2.0, category: 'Cabling' },
    { name: 'Patch Panel - 24 Port (Install)', description: 'Mount and punch down 24-port Cat6 patch panel.', baseCost: 110, avgLabor: 2.5, category: 'Cabling' },
    { name: 'Patch Panel - 48 Port (Install)', description: 'Mount and punch down 48-port Cat6 patch panel.', baseCost: 220, avgLabor: 4.0, category: 'Cabling' },
    { name: 'Cable Management - Horizontal (1U)', description: 'Install 19" rack mount cable manager.', baseCost: 25, avgLabor: 0.25, category: 'Cabling' },

    // --- 3. FIBER OPTICS ---
    { name: 'Fiber Run - Multimode OM4 (Indoor)', description: 'Pull 6-strand armored fiber distribution cable (up to 200ft).', baseCost: 180, avgLabor: 3.0, category: 'Fiber' },
    { name: 'Fiber Run - Singlemode OS2 (Indoor)', description: 'Pull 6-strand armored fiber distribution cable (up to 200ft).', baseCost: 160, avgLabor: 3.0, category: 'Fiber' },
    { name: 'Fiber Termination - LC Connector (Fusion Splice)', description: 'Precision fusion splice pigtail termination (Per Strand).', baseCost: 18, avgLabor: 0.5, category: 'Fiber' },
    { name: 'Fiber Termination - Mechanical Splice', description: 'Field installable connector termination (Per Strand).', baseCost: 25, avgLabor: 0.4, category: 'Fiber' },
    { name: 'Fiber Enclosure - 1U Rack Mount', description: 'Install fiber housing/LIU with adapter plates.', baseCost: 145, avgLabor: 1.0, category: 'Fiber' },
    { name: 'Fiber Patch Cord - Duplex LC-LC (3m)', description: 'Supply and install fiber jumper.', baseCost: 25, avgLabor: 0.1, category: 'Fiber' },

    // --- 4. NETWORKING EQUIPMENT ---
    { name: 'Network Switch Installation (Mount & Patch)', description: 'Rack mount switch, patch cables, and basic power up (Config separate).', baseCost: 15, avgLabor: 1.0, category: 'Networking' },
    { name: 'Wireless Access Point (WAP) - Installation', description: 'Mount and connect AP to ceiling grid or wall.', baseCost: 25, avgLabor: 1.0, category: 'Networking' },
    { name: 'Network Rack / Cabinet - Wall Mount (12U)', description: 'Assemble and mount wall cabinet for small office.', baseCost: 350, avgLabor: 3.0, category: 'Infrastructure' },
    { name: 'Network Rack - 2 Post Floor (45U)', description: 'Assemble and bolt down standard relay rack.', baseCost: 280, avgLabor: 3.5, category: 'Infrastructure' },
    { name: 'Server Cabinet - 4 Post Enclosed (42U)', description: 'Assemble heavy duty server enclosure.', baseCost: 1200, avgLabor: 5.0, category: 'Infrastructure' },
    { name: 'UPS Battery Backup - 1500VA', description: 'Install rack mount UPS.', baseCost: 550, avgLabor: 0.5, category: 'Infrastructure' },
    { name: 'PDU - Vertical Metered', description: 'Install zero-U power strip in cabinet.', baseCost: 180, avgLabor: 0.75, category: 'Infrastructure' },
    { name: 'Ladder Rack / Cable Tray (Per 5ft)', description: 'Install overhead cable conveyance system.', baseCost: 65, avgLabor: 1.5, category: 'Infrastructure' },

    // --- 5. SECURITY & SURVEILLANCE ---
    { name: 'IP Camera Installation - Dome/Bullet', description: 'Mount and aim PoE camera.', baseCost: 15, avgLabor: 1.5, category: 'Security' },
    { name: 'PTZ Camera Installation', description: 'Mount heavy duty Pan-Tilt-Zoom camera.', baseCost: 45, avgLabor: 2.5, category: 'Security' },
    { name: 'NVR / DVR Setup & Configuration', description: 'Install recorder, format HDD, and configure basic network settings.', baseCost: 0, avgLabor: 2.0, category: 'Security' },
    { name: 'Access Control - Door Controller', description: 'Install and wire single door access control board.', baseCost: 120, avgLabor: 3.0, category: 'Security' },
    { name: 'Card Reader / Keypad Install', description: 'Mount and terminate prox reader.', baseCost: 85, avgLabor: 1.25, category: 'Security' },
    { name: 'Maglock / Electric Strike Install', description: 'Cut frame and install locking hardware.', baseCost: 150, avgLabor: 3.0, category: 'Security' },
    { name: 'Request to Exit (REX) Sensor', description: 'Install motion sensor for door egress.', baseCost: 65, avgLabor: 1.0, category: 'Security' },

    // --- 6. AUDIO / VISUAL ---
    { name: 'TV / Display Mounting - Up to 55"', description: 'Install bracket and mount display.', baseCost: 45, avgLabor: 1.5, category: 'AV' },
    { name: 'TV / Display Mounting - 65"-85"', description: 'Heavy duty mounting (2 Man Crew).', baseCost: 85, avgLabor: 2.5, category: 'AV' },
    { name: 'Projector Ceiling Mount', description: 'Install projector and align image.', baseCost: 120, avgLabor: 2.5, category: 'AV' },
    { name: 'Projector Screen - Manual Pull', description: 'Mount wall/ceiling screen.', baseCost: 85, avgLabor: 1.5, category: 'AV' },
    { name: 'Projector Screen - Motorized', description: 'Mount electric screen and wire low voltage trigger.', baseCost: 150, avgLabor: 3.0, category: 'AV' },
    { name: 'Ceiling Speaker Installation (70V)', description: 'Cut tile and install drop ceiling speaker.', baseCost: 45, avgLabor: 1.0, category: 'AV' },
    { name: 'Volume Control Installation', description: 'Install wall-mounted attenuation dial.', baseCost: 35, avgLabor: 0.75, category: 'AV' },
    { name: 'Sound Masking Emitter', description: 'Install white noise emitter in plenum space.', baseCost: 65, avgLabor: 0.75, category: 'AV' },

    // --- 7. TELEPHONY / VOIP ---
    { name: 'VoIP Phone Deployment (Desk)', description: 'Unbox, connect, and verify registration.', baseCost: 0, avgLabor: 0.25, category: 'Voice' },
    { name: 'Conference Phone Setup', description: 'Install conference room unit and extension mics.', baseCost: 0, avgLabor: 0.75, category: 'Voice' },
    { name: 'Cross Connect - Voice Block (66/110)', description: 'Punch down cross connect for analog lines.', baseCost: 5, avgLabor: 0.5, category: 'Voice' },
    { name: 'Analog Gateway (ATA) Config', description: 'Install adapter for fax/legacy devices.', baseCost: 45, avgLabor: 1.0, category: 'Voice' },

    // --- 8. MISC / LABOR ---
    { name: 'Conduit Installation - EMT 3/4" (Per 10ft)', description: 'Bend and install surface mount conduit.', baseCost: 12, avgLabor: 1.0, category: 'Infrastructure' },
    { name: 'Conduit Installation - PVC 1" (Per 10ft)', description: 'Install underground or exterior conduit.', baseCost: 8, avgLabor: 0.75, category: 'Infrastructure' },
    { name: 'Firestop Penetration', description: 'Seal cable penetration with intumescent fire caulk/putty.', baseCost: 15, avgLabor: 0.5, category: 'Infrastructure' },
    { name: 'Old Cable Removal (Demo)', description: 'Remove abandoned cabling from ceiling plenum (Per Hour).', baseCost: 0, avgLabor: 1.0, category: 'Demo' },
    { name: 'Labeling & Documentation', description: 'Professional labeling of faceplates and patch panels.', baseCost: 5, avgLabor: 0.1, category: 'Admin' },
];
