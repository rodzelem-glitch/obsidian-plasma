
import React, { useMemo, useState } from 'react';
import type { Job, User } from 'types';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import Modal from 'components/ui/Modal';
import Textarea from 'components/ui/Textarea';
import { useAppContext } from 'context/AppContext';
import { db } from 'lib/firebase';
import { formatAddress } from 'lib/utils';
import { globalConfirm } from "lib/globalConfirm";

const TrashIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
);

const ChatBubbleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
    </svg>
);

const JobScheduling: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
    const [smsJob, setSmsJob] = useState<Job | null>(null);
    const [smsMessage, setSmsMessage] = useState('');

    const employees = useMemo(() => state.users.filter((u: User) => u.organizationId === state.currentOrganization?.id && (u.role === 'employee' || u.role === 'both' || u.role === 'supervisor')), [state.users, state.currentOrganization]);

    const allJobs = useMemo(() => {
        // Filter out jobs that are fully closed (Completed AND Paid)
        const activeJobs = (state.jobs as Job[]).filter((job: Job) => {
            const isCompleted = job.jobStatus === 'Completed';
            const isPaid = job.invoice?.status === 'Paid';
            return !(isCompleted && isPaid);
        });

        return activeJobs.sort((a: Job, b: Job) => {
            const timeA = new Date(a.appointmentTime).getTime();
            const timeB = new Date(b.appointmentTime).getTime();
            const validA = !isNaN(timeA) ? timeA : 0;
            const validB = !isNaN(timeB) ? timeB : 0;
            return validA - validB; 
        });
    }, [state.jobs]);

    const handleJobUpdate = async (jobId: string, field: keyof Job | 'assignedTechnicianId', value: any) => {
        const jobToUpdate = (allJobs as Job[]).find((job: Job) => job.id === jobId);
        if (!jobToUpdate) return;
        
        let updatedJob = { ...jobToUpdate, [field]: value };

        if (field === 'assignedTechnicianId') {
            const tech = employees.find((t: User) => t.id === value);
            updatedJob.assignedTechnicianName = tech ? `${tech.firstName} ${tech.lastName}` : undefined;
        }

        try {
            await db.collection('jobs').doc(jobId).set(updatedJob, { merge: true });
            dispatch({ type: 'UPDATE_JOB', payload: updatedJob });

            // AUTO-SEND GOOGLE REVIEW EMAIL if marked Completed
            if (field === 'jobStatus' && value === 'Completed') {
                const customer = state.customers.find((c: any) => c.name === updatedJob.customerName);
                const emailToSend = customer?.email || updatedJob.customerEmail;
                const org = state.currentOrganization;
                const orgName = org?.name || 'Service Provider';
                const smtp = org?.smtpConfig;
                
                if (emailToSend && org) {
                    const reviewLink = org.website || "#";
                    const htmlContent = `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                            <h2 style="color: #0284c7; text-align: center;">Thank You for Choosing ${orgName}!</h2>
                            <p>Hi ${updatedJob.customerName},</p>
                            <p>Our team has marked your service as complete. We hope everything is working perfectly.</p>
                            <p>As a local business, we rely on feedback from customers like you. Would you mind taking a moment to share your experience?</p>
                            <p style="text-align: center; margin: 30px 0;">
                                <a href="${reviewLink}" style="background-color: #f59e0b; color: white; padding: 14px 28px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;">
                                    ⭐ Leave a Review
                                </a>
                            </p>
                            <p>If you have any remaining questions or concerns, please reply to this email or call us.</p>
                            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                            <p style="font-size: 12px; color: #666; text-align: center;">${orgName}</p>
                        </div>
                    `;

                    // USE FIRESTORE TRIGGER EMAIL (SaaS Ready)
                    await db.collection('mail').add({
                        to: [emailToSend],
                        message: {
                            subject: `How did we do? - ${orgName}`,
                            html: htmlContent,
                            text: `Thank you for choosing ${orgName}! Please leave us a review: ${reviewLink}`,
                            replyTo: org.email,
                        },
                        organizationId: org.id,
                        status: 'pending',
                        type: 'ReviewRequest',
                        createdAt: new Date().toISOString(),
                        transport: smtp ? {
                            host: smtp.host,
                            port: smtp.port,
                            auth: {
                                user: smtp.user,
                                pass: smtp.pass
                            },
                            from: `"${smtp.fromName}" <${smtp.fromEmail}>`
                        } : undefined
                    });
                }
            }

        } catch (error) {
            console.error("Failed to update job:", error);
            alert("Failed to save changes.");
        }
    };

    const handleDeleteJob = async (jobId: string) => {
        if(await globalConfirm('Are you sure you want to delete this job record?')) {
            try {
                await db.collection('jobs').doc(jobId).delete();
                dispatch({ type: 'DELETE_JOB', payload: jobId });
            } catch (error) {
                console.error("Failed to delete job:", error);
            }
        }
    };
    
    const openSmsModal = (job: Job) => {
        setSmsJob(job);
        setSmsMessage(`Hi ${job.customerName}, this is ${state.currentOrganization?.name} verifying your appointment for ${new Date(job.appointmentTime).toLocaleDateString()}. Reply C to confirm.`);
        setIsSmsModalOpen(true);
    };

    const handleSendSms = async () => {
        if (!smsJob) return;
        alert('SMS Sent Successfully (Simulated)');
        setIsSmsModalOpen(false);
    };

    const formatDateTimeForInput = (isoString: string) => {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return '';
        const offset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - offset);
        return localDate.toISOString().slice(0, 16);
    };
    
    return (
        <div className="space-y-6">
             <Modal isOpen={isSmsModalOpen} onClose={() => setIsSmsModalOpen(false)} title="Send Customer SMS">
                 <div className="space-y-4">
                     <Textarea label="Message" value={smsMessage} onChange={(e: any) => setSmsMessage(e.target.value)} />
                     <div className="flex justify-end gap-4 pt-4">
                         <Button variant="secondary" onClick={() => setIsSmsModalOpen(false)}>Cancel</Button>
                         <Button onClick={handleSendSms}>Send Text</Button>
                     </div>
                 </div>
             </Modal>

             <header className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Job Scheduling & Assignment</h2>
                    <p className="text-gray-600 dark:text-gray-400">View active and unpaid jobs. Closed jobs are moved to History.</p>
                </div>
                <Button onClick={() => window.open('/#/book', '_blank')} className="w-auto">Open Booking Page</Button>
            </header>
            <Card>
                <Table headers={['Customer', 'Unit/System', 'Appointment Time', 'Invoice Status', 'Job Status', 'Assigned Technician', 'Actions']}>
                    {(allJobs as Job[]).map((job: Job) => {
                        const brandDisplay = job.hvacBrand || '---';
                        const typeDisplay = job.hvacType || '';
                        
                        return (
                        <tr key={job.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    {job.customerName}
                                    {(job.source === 'WebForm') && <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-600 dark:text-purple-400 text-[10px] font-bold">WEB</span>}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 max-w-[200px] truncate" title={formatAddress(job.address)}>
                                    {formatAddress(job.address)}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-700 dark:text-gray-300">
                                    <div className="font-bold text-blue-600 dark:text-blue-400">{brandDisplay}</div>
                                    {typeDisplay && <div className="text-xs">{typeDisplay}</div>}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <input 
                                    type="datetime-local"
                                    value={formatDateTimeForInput(job.appointmentTime)}
                                    onChange={(e) => handleJobUpdate(job.id, 'appointmentTime', new Date(e.target.value).toISOString())}
                                    className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md py-1.5 px-2 text-gray-900 dark:text-white text-sm focus:ring-primary-500 focus:border-primary-500"
                                />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${job.invoice?.status === 'Paid' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'}`}>
                                    {job.invoice?.status || 'Unknown'}
                                </span>
                            </td>
                             <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <select 
                                    value={job.jobStatus}
                                    onChange={(e) => handleJobUpdate(job.id, 'jobStatus', e.target.value)}
                                    className={`block w-full border border-gray-300 dark:border-gray-600 rounded-md py-1 px-2 text-sm focus:ring-primary-500 focus:border-primary-500 ${job.jobStatus === 'Completed' ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white'}`}
                                >
                                    <option value="Scheduled">Scheduled</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Completed">Completed</option>
                                </select>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                <select 
                                    value={job.assignedTechnicianId || ''}
                                    onChange={(e) => handleJobUpdate(job.id, 'assignedTechnicianId', e.target.value)}
                                    className="block w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md py-1.5 px-3 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                                >
                                    <option value="">Unassigned</option>
                                    {employees.map((tech: User) => (
                                        <option key={tech.id} value={tech.id}>{tech.firstName} {tech.lastName}</option>
                                    ))}
                                </select>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 flex gap-2">
                                <button onClick={() => openSmsModal(job)} className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 p-1"><ChatBubbleIcon className="w-5 h-5" /></button>
                                <button onClick={() => handleDeleteJob(job.id)} className="text-red-700 dark:text-red-400 font-bold hover:text-red-900 dark:hover:text-red-300 p-1 hover:bg-red-100 dark:hover:bg-red-900/40 rounded transition-colors"><TrashIcon className="w-5 h-5" /></button>
                            </td>
                        </tr>
                        );
                    })}
                    {allJobs.length === 0 && (
                        <tr>
                            <td colSpan={7} className="px-6 py-4 md:py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                No active jobs found. All completed and paid jobs are in History.
                            </td>
                        </tr>
                    )}
                </Table>
            </Card>
        </div>
    );
};

export default JobScheduling;
