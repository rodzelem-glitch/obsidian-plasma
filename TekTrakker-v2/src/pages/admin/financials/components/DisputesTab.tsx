import React, { useState } from 'react';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../lib/firebase';
import { useAppContext } from '../../../../context/AppContext';
import { useLanguage } from 'context/LanguageContext';

interface DisputesTabProps {
    disputes: any[];
}

const DisputesTab: React.FC<DisputesTabProps> = ({ disputes }) => {
    const { state } = useAppContext();
    const { t } = useLanguage();
    const [submitting, setSubmitting] = useState<string | null>(null);

    const handleSubmitEvidence = async (disputeId: string) => {
        const text = prompt(t('Enter evidence text to submit for this dispute:'));
        if (!text) return;

        setSubmitting(disputeId);
        try {
            const submitDisputeEvidence = httpsCallable(functions, 'submitDisputeEvidence');
            await submitDisputeEvidence({
                disputeId,
                organizationId: state.currentOrganization?.id,
                evidenceText: text
            });
            alert(t('Evidence submitted successfully. Status will update shortly.'));
        } catch (error: any) {
            console.error('Failed to submit evidence:', error);
            alert(`${t('Error:')} ${error.message}`);
        } finally {
            setSubmitting(null);
        }
    };

    return (
        <Card>
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-800 dark:text-white">{t("Chargebacks & Disputes")}</h3>
                <p className="text-sm text-gray-500">{t("Track and respond to payment disputes from customers.")}</p>
            </div>
            {disputes.length === 0 ? (
                <div className="p-8 text-center text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                    <p>{t("No disputes found.")}</p>
                    <p className="text-xs mt-2">{t("Any chargebacks filed by customers will appear here.")}</p>
                </div>
            ) : (
                <Table headers={[t('Date'), t('Amount'), t('Status'), t('Reason'), t('Charge ID'), t('Action')]}>
                    {disputes.map(d => (
                        <tr key={d.id}>
                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                {new Date(d.created * 1000 || d.created).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 font-bold text-red-600 dark:text-red-400">
                                ${(d.amount / 100).toFixed(2)}
                            </td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                    d.status === 'won' ? 'bg-green-100 text-green-800' :
                                    d.status === 'lost' ? 'bg-red-100 text-red-800' :
                                    d.status === 'needs_response' ? 'bg-amber-100 text-amber-800' :
                                    'bg-blue-100 text-blue-800'
                                }`}>
                                    {t(d.status || 'pending').replace(/_/g, ' ')}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white capitalize">
                                {t(d.reason || 'Unknown').replace(/_/g, ' ')}
                            </td>
                            <td className="px-6 py-4 font-mono text-xs text-gray-500 dark:text-gray-400">
                                {d.chargeId || d.charge_id}
                            </td>
                            <td className="px-6 py-4">
                                {d.status === 'needs_response' && (
                                    <button 
                                        onClick={() => handleSubmitEvidence(d.id)}
                                        disabled={submitting === d.id}
                                        className="text-xs px-3 py-1 bg-amber-500 text-white font-bold rounded-lg hover:bg-amber-600 disabled:opacity-50"
                                    >
                                        {submitting === d.id ? t('Submitting...') : t('Submit Evidence')}
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </Table>
            )}
        </Card>
    );
};

export default DisputesTab;
