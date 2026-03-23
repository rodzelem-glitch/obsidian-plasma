import { ProposalPreset } from '@types';

export const GENERAL_MASTER_BOOK: Omit<ProposalPreset, 'id' | 'organizationId'>[] = [
    { name: 'Furniture Assembly - Medium', description: 'Desk, bookshelf, or standard bed.', baseCost: 0, avgLabor: 2, category: 'Other' },
    { name: 'TV Wall Mount - Up to 55"', description: 'Mounting on drywall with cable hiding.', baseCost: 45, avgLabor: 1.5, category: 'Accessories' },
    { name: 'Door Lock Replacement', description: 'Swap standard residential hardware.', baseCost: 0, avgLabor: 0.75, category: 'Contracting' },
    { name: 'Smart Lock Installation', description: 'Retrofit standard deadbolt with tech.', baseCost: 0, avgLabor: 1.25, category: 'Accessories' }
];