const { execSync } = require('child_process');
const fs = require('fs');

execSync('git restore src/pages/admin/DashboardDetails.tsx');

let code = fs.readFileSync('src/pages/admin/DashboardDetails.tsx', 'utf8');

const importsToAdd = `import { Trash2, ShoppingCart, RefreshCw, Calendar, Mail } from 'lucide-react';\nimport { db } from 'lib/firebase';\nimport { collection, addDoc } from 'firebase/firestore';`;
code = code.replace(/import { Trash2, ShoppingCart, RefreshCw } from 'lucide-react';/, importsToAdd);

const upcomingMaintenanceCode = `
export const UpcomingMaintenanceView: React.FC = () => {
    const { state } = useAppContext();
    const navigate = useNavigate();
    
    const upcomingList: any[] = [];
    const now = new Date();
    
    Object.values(state.customers).forEach(customer => {
        if(customer.equipment) {
            customer.equipment.forEach(asset => {
                if(asset.warranty?.requiresMaintenance && asset.warranty.maintenanceIntervalMonths) {
                    let nextDate = new Date();
                    if(asset.warranty.lastMaintenanceDate) {
                        nextDate = new Date(asset.warranty.lastMaintenanceDate);
                    } else if(asset.warranty.manufacturerStartDate) {
                        nextDate = new Date(asset.warranty.manufacturerStartDate);
                        nextDate.setDate(nextDate.getDate() + 1);
                    } else {
                        return;
                    }
                    
                    nextDate.setMonth(nextDate.getMonth() + asset.warranty.maintenanceIntervalMonths);
                    const diffTime = nextDate.getTime() - now.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    if(diffDays <= 45) {
                        upcomingList.push({
                            customer,
                            asset,
                            nextDate,
                            daysUntil: diffDays,
                            isOverdue: diffDays < 0
                        });
                    }
                }
            });
        }
    });

    upcomingList.sort((a,b) => a.daysUntil - b.daysUntil);

    const handleSendReminder = async (item: any) => {
        if (!item.customer.email) {
            alert("No email address found for this customer.");
            return;
        }
        if (await globalConfirm(\`Send an automated reminder email to \${item.customer.name} (\${item.customer.email})?\`)) {
            try {
                const orgName = state.currentOrganization?.name || 'Service Provider';
                const orgEmail = state.currentOrganization?.email || '';
                const orgLicense = state.currentOrganization?.settings?.licenseNumber || state.currentOrganization?.licenseNumber || '';
                const portalUrl = \`https://tektrakker-v2.web.app/#/portal/auth?orgId=\${item.customer.organizationId}\`;
                
                const licenseFooterText = orgLicense ? \`\\n\\nState License: \${orgLicense}\` : '';
                const licenseFooterHtml = orgLicense ? \`<br/><br/><small style="color:#6b7280;font-size:12px;">State License: \${orgLicense}</small>\` : '';

                await addDoc(collection(db, 'mail'), {
                     toUids: [item.customer.id],
                     to: item.customer.email,
                     message: {
                         from: \`\${orgName} <no-reply@tektrakker.com>\`,
                         ...(orgEmail ? { replyTo: orgEmail } : {}),
                         subject: \`Action Required: Maintenance due for your \${item.asset.brand || ''} Equipment\`,
                         text: \`Hello \${item.customer.name || 'Valued Customer'},\\n\\nThis is a friendly reminder from \${orgName} that your \${item.asset.brand || 'HVAC'} \${item.asset.type || 'system'} is due for routine warranty maintenance in \${item.daysUntil} days.\\n\\nPlease schedule an appointment through your portal to maintain your warranty compliance: \${portalUrl}\\n\\nThank you,\\n\${orgName}\${licenseFooterText}\`,
                         html: \`<p>Hello <strong>\${item.customer.name || 'Valued Customer'}</strong>,</p>
                                <p>This is a friendly reminder from <strong>\${orgName}</strong> that your <strong>\${item.asset.brand || 'HVAC'} \${item.asset.type || 'system'}</strong> is due for routine warranty maintenance in <strong>\${item.daysUntil} days</strong>.</p>
                                <p>Please schedule an appointment through your portal to maintain your warranty coverage.</p>
                                <p><a href="\${portalUrl}" style="background-color:#2563eb;color:white;padding:10px 15px;text-decoration:none;border-radius:5px;display:inline-block;margin-top:10px;">Access Service Portal to Schedule</a></p>
                                <p>Thank you,<br/><strong>\${orgName}</strong></p>\${licenseFooterHtml}\`
                     }
                });
                alert(\`Reminder email queued for \${item.customer.name}!\`);
            } catch (e: any) {
                console.error("Failed to queue mail docs", e);
                alert(\`Failed to send: \${e.message}\`);
            }
        }
    };

    return (
        <div>
            <BackButton />
            <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Calendar className="text-blue-600" /> Upcoming Maintenance Calls</h2>
                    <p className="text-gray-600 dark:text-gray-400">Assets and equipment due for routine warranty maintenance in the next 45 days.</p>
                </div>
            </header>
            <Card>
                <Table headers={['Customer', 'Equipment', 'Last Serviced', 'Next Due', 'Status', 'Actions']}>
                    {upcomingList.map((item, idx) => (
                        <tr key={idx}>
                            <td className="px-6 py-4">
                                <div className="text-gray-900 dark:text-white font-medium">{item.customer.name}</div>
                                <div className="text-xs text-gray-500">{item.customer.phone || 'No phone'}</div>
                            </td>
                            <td className="px-6 py-4">
                                <span className="font-semibold">{item.asset.brand} - {item.asset.type}</span>
                                <div className="text-xs text-slate-500">M/N: {item.asset.model || 'Unknown'}</div>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                                {item.asset.warranty?.lastMaintenanceDate ? new Date(item.asset.warranty.lastMaintenanceDate).toLocaleDateString() : 'Never'}
                            </td>
                            <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                                {item.nextDate.toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 text-sm">
                                {item.isOverdue ? (
                                    <span className="px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                        Overdue ({-item.daysUntil} days)
                                    </span>
                                ) : (
                                    <span className="px-2 py-1 rounded text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                        Due in {item.daysUntil} days
                                    </span>
                                )}
                            </td>
                            <td className="px-6 py-4">
                                <button
                                    onClick={() => handleSendReminder(item)}
                                    className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded transition-colors"
                                >
                                    <Mail size={14} /> Send Reminder
                                </button>
                            </td>
                        </tr>
                    ))}
                    {upcomingList.length === 0 && (
                        <tr><td colSpan={6} className="p-6 text-center text-gray-500">Nothing due in the next 45 days.</td></tr>
                    )}
                </Table>
            </Card>
        </div>
    );
};
`;

fs.writeFileSync('src/pages/admin/DashboardDetails.tsx', code + '\n' + upcomingMaintenanceCode);
console.log('Restored and updated DashboardDetails!');
