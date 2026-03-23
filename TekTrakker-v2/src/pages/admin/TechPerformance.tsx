
import React, { useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import Leaderboard from './performance/components/Leaderboard';
import RosterTable from './performance/components/RosterTable';

const TechPerformance: React.FC = () => {
    const { state } = useAppContext();
    
    const stats = useMemo(() => {
        const techs = state.users.filter(u => 
            u.organizationId === state.currentOrganization?.id &&
            (u.role === 'employee' || u.role === 'both' || u.role === 'supervisor')
        );
        
        return techs.map(tech => {
            const myJobs = state.jobs.filter(j => j.assignedTechnicianId === tech.id);
            const completed = myJobs.filter(j => j.jobStatus === 'Completed').length;
            const revenue = myJobs.reduce((sum, j) => sum + (j.invoice.status === 'Paid' ? j.invoice.amount : 0), 0);
            const avgTicket = completed > 0 ? revenue / completed : 0;
            return { ...tech, completed, revenue, avgTicket };
        }).sort((a, b) => b.revenue - a.revenue);
    }, [state.users, state.jobs, state.currentOrganization]);

    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Technician Performance</h2>
                <p className="text-gray-600 dark:text-gray-400">Revenue leaderboard and job statistics.</p>
            </header>

            <Leaderboard topTechs={stats.slice(0, 3)} />
            <RosterTable stats={stats} />
        </div>
    );
};

export default TechPerformance;
