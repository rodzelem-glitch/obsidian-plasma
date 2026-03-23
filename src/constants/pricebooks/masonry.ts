
import { ProposalPreset } from 'types';

export const MASONRY_MASTER_BOOK: Omit<ProposalPreset, 'id' | 'organizationId'>[] = [
    { name: 'Brick Repair - Minor (Per Sqft)', description: 'Replace damaged bricks and mortar matching existing.', baseCost: 15, avgLabor: 2, category: 'Masonry' },
    { name: 'Tuckpointing (Per Sqft)', description: 'Grind out old mortar and replace with new.', baseCost: 8, avgLabor: 1.5, category: 'Masonry' },
    { name: 'Concrete Driveway Pour (Per Sqft)', description: 'Form, pour, and finish 4" reinforced concrete.', baseCost: 4, avgLabor: 0.5, category: 'Masonry' },
    { name: 'Stone Veneer Installation (Per Sqft)', description: 'Install cultured stone on prepared surface.', baseCost: 12, avgLabor: 2, category: 'Masonry' },
    { name: 'Paver Patio Installation (Per Sqft)', description: 'Base prep and install concrete pavers.', baseCost: 10, avgLabor: 1.5, category: 'Masonry' },
    { name: 'Chimney Crown Repair', description: 'Resurface or replace cracked concrete chimney crown.', baseCost: 150, avgLabor: 4, category: 'Masonry' },
    { name: 'Retaining Wall - Block (Per Sqft Face)', description: 'Build segmental block retaining wall.', baseCost: 25, avgLabor: 3, category: 'Masonry' },
    { name: 'Pressure Wash - Masonry', description: 'Deep clean brick or stone surfaces.', baseCost: 0.25, avgLabor: 0.05, category: 'Maintenance' },
    { name: 'Waterproofing Sealer (Per Sqft)', description: 'Apply breathable sealant to masonry surfaces.', baseCost: 0.5, avgLabor: 0.1, category: 'Maintenance' },
    { name: 'Foundation Crack Repair', description: 'Epoxy injection for minor foundation cracks.', baseCost: 45, avgLabor: 2, category: 'Masonry' }
];
