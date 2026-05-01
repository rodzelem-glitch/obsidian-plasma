export const EQUIPMENT_OPTIONS: Record<string, string[]> = {
    'HVAC': ['System', 'Split System', 'Package Unit', 'Furnace', 'Condenser', 'Air Handler', 'Heat Pump', 'Boiler', 'Chiller', 'Generator', 'Other'],
    'Plumbing': ['Water Heater', 'Tankless Water Heater', 'Boiler', 'Sump Pump', 'Well Pump', 'Water Softener', 'Filtration System', 'Fixture', 'Piping', 'Septic System', 'Other'],
    'Electrical': ['Panel', 'Subpanel', 'Generator', 'Transformer', 'Switchgear', 'Lighting System', 'EV Charger', 'Meter', 'Disconnect', 'Other'],
    'Landscaping': ['Irrigation System', 'Sprinkler Controller', 'Pump', 'Lighting System', 'Water Feature', 'Equipment', 'Other'],
    'Telecommunications': ['Router', 'Switch', 'Server', 'Antenna', 'PBX System', 'Modem', 'Fiber Node', 'Other'],
    'Solar': ['Solar Panel', 'Inverter', 'Battery Bank', 'Charge Controller', 'Optimizer', 'Other'],
    'Security': ['Camera', 'NVR/DVR', 'Alarm Panel', 'Access Control System', 'Sensor', 'Intercom', 'Other'],
    'Pet Grooming': ['Grooming Table', 'Tub', 'Dryer', 'Clipper System', 'Other'],
    'Cleaning': ['Vacuum', 'Floor Scrubber', 'Carpet Extractor', 'Pressure Washer', 'Other'],
    'default': ['Equipment', 'Tool', 'Vehicle', 'System', 'Component', 'Machine', 'Other']
};

export const LOCATION_OPTIONS: Record<string, string[]> = {
    'Landscaping': ['Property', 'Campus', 'Section', 'Bed', 'Zone', 'Other'],
    'Solar': ['Property', 'Building', 'Roof', 'Ground Mount', 'Zone', 'Other'],
    'Plumbing': ['Property', 'Building', 'Floor', 'Room', 'Zone', 'Other'],
    'Electrical': ['Property', 'Building', 'Floor', 'Room', 'Zone', 'Other'],
    'default': ['Property', 'Campus', 'Building', 'Wing', 'Floor', 'Room', 'Zone', 'Other']
};
