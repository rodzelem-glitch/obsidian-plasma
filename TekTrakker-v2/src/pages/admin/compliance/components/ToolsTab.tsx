
import React from 'react';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import { ToolMaintenanceLog } from 'types';

interface ToolsTabProps {
    toolLogs: ToolMaintenanceLog[];
    setIsLogMaintenanceOpen: (val: boolean) => void;
}

const ToolsTab: React.FC<ToolsTabProps> = ({ toolLogs, setIsLogMaintenanceOpen }) => {
    return (
        <Card>
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">Maintenance Logs</h3>
                <Button onClick={() => setIsLogMaintenanceOpen(true)} className="w-auto text-xs">Log Service</Button>
            </div>
            <Table headers={['Date', 'Tool', 'Serial #', 'Action', 'Result', 'Next Due']}>
                {toolLogs.map((log: any) => (
                    <tr key={log.id}>
                        <td className="px-6 py-4 text-sm">{new Date(log.date).toLocaleDateString()}</td>
                        <td className="px-6 py-4 font-bold">{log.toolType}</td>
                        <td className="px-6 py-4 font-mono">{log.serialNumber}</td>
                        <td className="px-6 py-4">{log.action}</td>
                        <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-bold ${log.result === 'Pass' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{log.result}</span></td>
                        <td className="px-6 py-4 text-sm">{log.nextDueDate}</td>
                    </tr>
                ))}
            </Table>
        </Card>
    );
};

export default ToolsTab;
