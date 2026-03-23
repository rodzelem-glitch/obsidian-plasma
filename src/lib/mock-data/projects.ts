
import type { Project } from '../../types';

export const MOCK_DEMO_PROJECTS: Project[] = [
    {
        id: 'demo-project-1',
        organizationId: 'demo-org-123',
        name: 'New Furnace Installation',
        customerId: 'demo-cust-2',
        customerName: 'Sarah Smith',
        status: 'In Progress',
        startDate: '2024-07-15T09:00:00Z',
        endDate: '2024-07-18T17:00:00Z',
        budget: 8500,
        description: 'Full replacement of an old furnace with a new high-efficiency model.',
        address: '101 Main St, Denver, CO 80202',
        managerId: 'demo-admin-id',
        teamIds: ['demo-tech-id', 'demo-tech-2-id'],
        projectTasks: [
            {
                id: 'task-1',
                description: 'Remove old furnace and prepare site',
                status: 'Completed',
                isBenchmark: true,
                dueDate: '2024-07-15'
            },
            {
                id: 'task-2',
                description: 'Install new furnace unit and connect ductwork',
                status: 'In Progress',
                isBenchmark: true,
                assignedTo: 'demo-tech-id',
                dueDate: '2024-07-16'
            },
            {
                id: 'task-3',
                description: 'Install new thermostat and configure settings',
                status: 'Pending',
                isBenchmark: false,
                assignedTo: 'demo-tech-2-id',
                dueDate: '2024-07-17'
            },
            {
                id: 'task-4',
                description: 'Final system test and quality check',
                status: 'Pending',
                isBenchmark: true,
                dueDate: '2024-07-18'
            }
        ],
        notesList: [
            { id: 'note-1', author: 'Alex Admin', content: 'Customer is also interested in a smart thermostat upgrade. See proposal #PROP-002.', timestamp: '2024-07-10T11:00:00Z' }
        ],
        createdAt: '2024-07-01T14:00:00Z'
    },
    {
        id: 'demo-project-2',
        organizationId: 'demo-org-123',
        name: 'Commercial RTU Upgrade',
        customerId: 'demo-cust-3',
        customerName: 'Downtown Cafe',
        status: 'Planning',
        startDate: '2024-08-01T09:00:00Z',
        endDate: '2024-08-05T17:00:00Z',
        budget: 25000,
        description: 'Replacing two aging rooftop units with new, energy-efficient models.',
        address: '456 Business Blvd, Denver, CO 80203',
        managerId: 'demo-master-admin-id',
        createdAt: '2024-06-20T16:00:00Z'
    }
];
