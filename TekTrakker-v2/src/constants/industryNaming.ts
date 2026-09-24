export const EQUIPMENT_OPTIONS: Record<string, string[]> = {
    'HVAC': ['System', 'Split System', 'Package Unit', 'Furnace', 'Condenser', 'Air Handler', 'Heat Pump', 'Boiler', 'Chiller', 'Generator', 'Other'],
    'Plumbing': ['Water Heater', 'Tankless Water Heater', 'Boiler', 'Sump Pump', 'Well Pump', 'Water Softener', 'Filtration System', 'Fixture', 'Piping', 'Septic System', 'Garbage Disposal', 'Backflow Preventer', 'Sewage Ejector Pump', 'Recirculation Pump', 'Pressure Reducing Valve (PRV)', 'Sewer Line / Lateral', 'Other'],
    'Electrical': ['Panel', 'Subpanel', 'Generator', 'Transformer', 'Switchgear', 'Lighting System', 'EV Charger', 'Meter', 'Disconnect', 'Transfer Switch (ATS)', 'Battery Storage (ESS)', 'Surge Protection Device (SPD)', 'Automation / Smart Hub', 'Other'],
    'Landscaping': ['Irrigation System', 'Sprinkler Controller', 'Backflow Preventer', 'Pump', 'Lighting System', 'Low-Voltage Transformer', 'Water Feature', 'Mower / Zero-Turn', 'Skid Steer / Heavy Machinery', 'Aerator / Dethatching', 'Equipment', 'Other'],
    'Roofing': ['Shingle System', 'Flat Membrane (TPO/EPDM/ModBit)', 'Metal Roof Panel', 'Tile / Slate Assembly', 'Flashing & Counter-Flashing', 'Gutter & Downspout', 'Attic Exhaust Vent / Fan', 'Ridge Vent System', 'Skylight Assembly', 'Scupper & Collector Box', 'Other'],
    'Painting': ['Airless Paint Sprayer', 'HVLP Spray Rig', 'Pressure Washer (Cold/Hot)', 'Drywall Dustless Sander', 'Scaffolding / Staging Tower', 'Extension Ladder / Ladder System', 'Pneumatic Paint Mixer', 'Epoxy / Polyaspartic Mixer', 'Wallpaper Steamer', 'Paint Line Striper', 'Other'],
    'Contracting': ['Scaffolding', 'Dumpster / Roll-Off', 'Power Tools', 'Ladders / Lifts', 'Generator', 'Air Scrubber', 'Concrete Mixer', 'Drywall Lift', 'Compactor / Excavation', 'Other'],
    'General': ['Tools & Hardware', 'Ladder & Scaffolding', 'Power Tools', 'Door & Window Hardware', 'Mounting & Fasteners', 'Drywall & Painting Kit', 'Safety Equipment', 'Other'],
    'Masonry': ['Mortar Mixer', 'Concrete Saw / Wet Saw', 'Jackhammer / Breaker', 'Plate Compactor', 'Scaffolding System', 'Masonry Saw', 'Pressure Washer', 'Parging / Spray Rig', 'Other'],
    'Telecommunications': ['Router', 'Switch', 'Server', 'Antenna', 'PBX System', 'Modem', 'Fiber Node', 'Wireless Access Point (WAP)', 'Patch Panel', 'Server Rack / Cabinet', 'UPS / Battery Backup', 'VoIP Phone / Gateway', 'Firewall / Gateway', 'Fiber Enclosure', 'Other'],
    'Solar': ['Solar Panel', 'Microinverter', 'String Inverter', 'Inverter', 'Battery Bank', 'Charge Controller', 'Optimizer', 'Combiner Box', 'Rapid Shutdown Device', 'System Gateway', 'Solar EV Charger', 'Other'],
    'Security': ['Camera', 'NVR/DVR', 'Alarm Panel', 'Access Control System', 'Sensor', 'Intercom', 'Keypad', 'Motion Detector', 'Door Lock / Maglock', 'Panic Button', 'Siren / Strobe', 'Power Supply Unit (PSU)', 'Other'],
    'Pet Grooming': ['Grooming Table', 'Tub', 'Dryer', 'Clipper System', 'Nail Grinder / Dremel', 'De-matting Tool', 'Mobile Grooming Van Unit', 'Water Heater / Tank', 'Other'],
    'Cleaning': ['Vacuum', 'Floor Scrubber', 'Carpet Extractor', 'Pressure Washer', 'Steam Cleaner', 'Ozone Generator', 'Floor Buffer / Burnisher', 'Ladder / Scaffolding', 'Other'],
    'default': ['Equipment', 'Tool', 'Vehicle', 'System', 'Component', 'Machine', 'Other']
};

export const LOCATION_OPTIONS: Record<string, string[]> = {
    'Landscaping': ['Property', 'Campus', 'Front Yard', 'Backyard', 'Side Yard', 'Turf / Lawn Area', 'Landscape Bed', 'Patio / Hardscape', 'Perimeter', 'Section', 'Bed', 'Zone', 'Other'],
    'Roofing': ['Main Roof Pitch', 'Garage Roof', 'Porch / Patio Cover', 'Ridge / Peak', 'Valleys', 'Eaves & Fascia / Overhang', 'Roof-to-Wall Transition', 'Chimney / Skylight Area', 'Parapet Wall', 'Flat Roof Deck', 'Gutter Perimeter', 'Other'],
    'Painting': ['Interior Wall/Ceiling', 'Interior Trim/Doors', 'Kitchen/Bathroom Cabinets', 'Exterior Siding/Façade', 'Soffit & Fascia', 'Deck / Patio / Fence', 'Garage Floor / Epoxy Zone', 'Brick / Masonry Wall', 'Building Envelope', 'Room', 'Other'],
    'Contracting': ['Jobsite / Build Site', 'Building / Structure', 'Floor / Level', 'Room / Zone', 'Exterior / Framing', 'Foundation / Basement', 'Other'],
    'Masonry': ['Exterior Wall', 'Interior Wall', 'Chimney / Fireplace', 'Foundation', 'Patio / Walkway', 'Driveway', 'Retaining Wall', 'Porch / Steps', 'Property', 'Building', 'Other'],
    'Telecommunications': ['MDF (Main Server Room)', 'IDF (Telecom Closet)', 'MPOE / Demarc', 'Rack / Cabinet', 'Workstation / Drop Point', 'Ceiling Grid', 'Rooftop / Exterior', 'Other'],
    'Solar': ['Property', 'Building', 'Roof', 'Roof - South', 'Roof - East/West', 'Ground Mount', 'Carport / Canopy', 'Electrical Room', 'Zone', 'Other'],
    'Security': ['Property', 'Building', 'Entryway / Door', 'Perimeter / Fence', 'Eaves / Exterior', 'Server / IT Room', 'Lobby / Reception', 'Parking Lot', 'Floor', 'Room', 'Zone', 'Other'],
    'Pet Grooming': ['Grooming Salon', 'Mobile Van / Unit', 'Bathing Station / Tub Area', 'Grooming Table / Workstation', 'Drying & Kennel Station', 'Intake / Reception Desk', 'Client Residence (On-site)', 'Other'],
    'Cleaning': ['Property', 'Building', 'Floor', 'Room', 'Unit/Suite', 'Restroom', 'Kitchen', 'Common Area', 'Exterior', 'Zone', 'Other'],
    'Plumbing': ['Property', 'Building', 'Floor', 'Room', 'Mechanical Room', 'Basement', 'Crawl Space', 'Attic', 'Kitchen', 'Bathroom', 'Utility Closet', 'Exterior / Yard', 'Garage', 'Zone', 'Other'],
    'Electrical': ['Property', 'Building', 'Floor', 'Room', 'Electrical Room', 'Electrical Closet', 'Main Service Entrance', 'Sub-Panel Bay', 'Garage', 'Basement', 'Zone', 'Other'],
    'default': ['Property', 'Campus', 'Building', 'Wing', 'Floor', 'Room', 'Zone', 'Other']
};
