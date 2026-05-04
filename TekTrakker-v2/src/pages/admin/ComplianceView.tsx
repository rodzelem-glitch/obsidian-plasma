import React from 'react';
import HRResources from 'pages/HRResources';

const ComplianceView: React.FC = () => {
    return (
        <div className="space-y-4">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">HR & Safety</h2>
            <div className="mt-4">
                <HRResources />
            </div>
        </div>
    );
};

export default ComplianceView;
