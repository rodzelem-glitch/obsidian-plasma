import React, { useState, useEffect, useMemo } from 'react';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Textarea from 'components/ui/Textarea';
import { Mail, Send, X, Plus, Check, User, Building, FileText, AlertCircle, Users, Paperclip } from 'lucide-react';
import { useAppContext } from 'context/AppContext';
import { useLanguage } from 'context/LanguageContext';
import showToast from 'lib/toast';
import { generateStatementOfAccountPdfAttachment, EmailAttachment } from 'lib/pdfHelper';
import { sendEmail } from 'lib/notificationService';
import { formatPaymentInstructionsHtml } from 'lib/paymentInstructionsHelper';
import { getOrGenerateAccountNumber } from 'lib/utils';

export interface EmailStatementModalProps {
    isOpen: boolean;
    onClose: () => void;
    customer: any;
    org: any;
    statementJobs: any[];
    statementTotals: any;
    statementPeriod?: string;
    statementNumber?: string;
    zIndex?: string;
}

interface DiscoveredContact {
    email: string;
    name: string;
    role: string;
    source: 'billing' | 'primary' | 'contact' | 'location';
}

const EmailStatementModal: React.FC<EmailStatementModalProps> = ({
    isOpen,
    onClose,
    customer,
    org,
    statementJobs,
    statementTotals,
    statementPeriod: initialStatementPeriod,
    statementNumber: initialStatementNumber,
    zIndex = 'z-[10080]'
}) => {
    const { state } = useAppContext();
    const { t } = useLanguage();

    const [recipients, setRecipients] = useState<string[]>([]);
    const [newEmailInput, setNewEmailInput] = useState('');
    const [subject, setSubject] = useState('');
    const [customMessage, setCustomMessage] = useState('');
    const [isSending, setIsSending] = useState(false);

    // Compute period & statement number
    const { statementPeriod, statementNumber } = useMemo(() => {
        if (initialStatementPeriod && initialStatementNumber) {
            return {
                statementPeriod: initialStatementPeriod,
                statementNumber: initialStatementNumber
            };
        }
        const dates = (statementJobs || []).map((tx: any) => new Date(tx.job?.appointmentTime || tx.job?.createdAt || 0).getTime()).filter((t: number) => !isNaN(t) && t > 0);
        const minDate = dates.length > 0 ? new Date(Math.min(...dates)).toLocaleDateString() : 'N/A';
        const maxDate = dates.length > 0 ? new Date(Math.max(...dates)).toLocaleDateString() : 'N/A';
        const period = `${minDate} - ${maxDate}`;
        const number = `SOA-${(customer?.id || 'CUST').slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;
        return {
            statementPeriod: initialStatementPeriod || period,
            statementNumber: initialStatementNumber || number
        };
    }, [initialStatementPeriod, initialStatementNumber, statementJobs, customer?.id]);

    // Discover all possible contacts on this customer profile
    const discoveredContacts = useMemo<DiscoveredContact[]>(() => {
        if (!customer) return [];
        const map = new Map<string, DiscoveredContact>();

        // 1. Primary Email
        if (customer.email && typeof customer.email === 'string' && customer.email.includes('@')) {
            const clean = customer.email.trim().toLowerCase();
            map.set(clean, {
                email: clean,
                name: customer.name || 'Primary Account',
                role: 'Primary Account',
                source: 'primary'
            });
        }

        // 2. Billing Contact
        if (customer.billingContact?.email && typeof customer.billingContact.email === 'string' && customer.billingContact.email.includes('@')) {
            const clean = customer.billingContact.email.trim().toLowerCase();
            map.set(clean, {
                email: clean,
                name: customer.billingContact.name || customer.name || 'Billing Department',
                role: 'Billing Contact',
                source: 'billing'
            });
        }

        // 3. Customer Contacts Array
        if (Array.isArray(customer.contacts)) {
            customer.contacts.forEach((c: any) => {
                if (c && c.email && typeof c.email === 'string' && c.email.includes('@')) {
                    const clean = c.email.trim().toLowerCase();
                    if (!map.has(clean)) {
                        map.set(clean, {
                            email: clean,
                            name: c.name || clean,
                            role: c.role || c.title || 'Authorized Contact',
                            source: 'contact'
                        });
                    }
                }
            });
        }

        // 4. Service Location Contacts
        if (Array.isArray(customer.serviceLocations)) {
            customer.serviceLocations.forEach((loc: any) => {
                const locEmail = loc?.contactEmail || loc?.email;
                if (locEmail && typeof locEmail === 'string' && locEmail.includes('@')) {
                    const clean = locEmail.trim().toLowerCase();
                    if (!map.has(clean)) {
                        map.set(clean, {
                            email: clean,
                            name: loc.contactName || loc.name || 'Site Contact',
                            role: `Location: ${loc.name || 'Site'}`,
                            source: 'location'
                        });
                    }
                }
            });
        }

        return Array.from(map.values());
    }, [customer]);

    // Initialize state when modal opens
    useEffect(() => {
        if (!isOpen) return;

        const initialRecipients: string[] = [];
        const billingEmail = customer?.billingContact?.email?.trim().toLowerCase();
        const primaryEmail = customer?.email?.trim().toLowerCase();

        // Check for any contact explicitly flagged for billing, statements, or AP
        const statementContact = Array.isArray(customer?.contacts)
            ? customer.contacts.find((c: any) =>
                c && c.email && typeof c.email === 'string' && c.email.includes('@') && (
                    c.isBillingContact ||
                    c.contactRoles?.includes('statements') ||
                    c.contactRoles?.includes('ap') ||
                    c.title?.toLowerCase().includes('statement') ||
                    c.notes?.toLowerCase().includes('statement')
                )
            )
            : null;
        const statementContactEmail = statementContact?.email?.trim().toLowerCase();

        if (billingEmail && billingEmail.includes('@')) {
            initialRecipients.push(billingEmail);
        } else if (statementContactEmail && statementContactEmail.includes('@')) {
            initialRecipients.push(statementContactEmail);
        } else if (primaryEmail && primaryEmail.includes('@')) {
            initialRecipients.push(primaryEmail);
        }

        setRecipients(initialRecipients);
        setNewEmailInput('');
        setCustomMessage('');
        setSubject(`Statement of Account: ${customer?.name || 'Customer'} - ${statementNumber}`);
        setIsSending(false);
    }, [isOpen, customer, statementNumber]);

    // Add a custom email
    const handleAddCustomEmail = () => {
        const clean = newEmailInput.trim().toLowerCase();
        if (!clean) {
            showToast.warn("Please enter an email address.");
            return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(clean)) {
            showToast.warn("Please enter a valid email address.");
            return;
        }
        if (recipients.some(r => r.toLowerCase() === clean)) {
            showToast.info("This email is already in the recipient list.");
            return;
        }

        setRecipients(prev => [...prev, clean]);
        setNewEmailInput('');
    };

    // Toggle contact in/out of recipient list
    const handleToggleContact = (email: string) => {
        const clean = email.trim().toLowerCase();
        if (recipients.some(r => r.toLowerCase() === clean)) {
            setRecipients(prev => prev.filter(r => r.toLowerCase() !== clean));
        } else {
            setRecipients(prev => [...prev, clean]);
        }
    };

    // Remove recipient
    const handleRemoveRecipient = (emailToRemove: string) => {
        const clean = emailToRemove.trim().toLowerCase();
        setRecipients(prev => prev.filter(r => r.toLowerCase() !== clean));
    };

    // Find contact metadata for badge label
    const getContactMeta = (email: string) => {
        return discoveredContacts.find(c => c.email.toLowerCase() === email.toLowerCase());
    };

    // Send statement
    const handleSend = async () => {
        if (recipients.length === 0) {
            showToast.warn("Please add at least one recipient email address.");
            return;
        }

        setIsSending(true);
        try {
            const activeOrg = org || state.currentOrganization;
            const isTekAir = String(activeOrg?.name || '').toLowerCase().includes('tekair') || activeOrg?.id === 'org-1765817997819';
            const orgName = activeOrg?.name || (isTekAir ? 'TekAir Inc.' : 'Service Provider');
            const orgPhone = activeOrg?.phone || (isTekAir ? '210-318-4197' : '');
            const orgEmail = activeOrg?.email || (isTekAir ? 'Operations@tekairinc.com' : '');
            const orgAddress = activeOrg?.address 
                ? (typeof activeOrg.address === 'string' ? activeOrg.address : `${activeOrg.address.street || ''}, ${activeOrg.address.city || ''}, ${activeOrg.address.state || ''} ${activeOrg.address.zip || ''}`)
                : (isTekAir ? '2618 Middleground, San Antonio, TX 78245' : '');
            const licenseNumber = activeOrg?.licenseNumber || activeOrg?.taxId || (isTekAir ? 'TACLA73240E' : '');
            const orgLogo = activeOrg?.logoUrl || activeOrg?.letterheadDataUrl || (isTekAir ? 'https://firebasestorage.googleapis.com/v0/b/tektrakker.firebasestorage.app/o/public_assets%2Forg-1765817997819%2Flogo_stable_1774702115808.png?alt=media&token=08c347fe-a7b0-40d9-b23f-6a2adecf63e9' : '');

            // 1. Generate official vector PDF attachment
            const { attachment } = await generateStatementOfAccountPdfAttachment({
                customer,
                org: activeOrg,
                statementJobs,
                statementTotals,
                statementPeriod,
                statementNumber
            });

            // 2. Build HTML email body
            const invoiceRows = (statementJobs || []).map((tx: any, idx: number) => {
                const j = tx.job || {};
                const inv = tx.invoice || {};
                const tVal = Number(tx.total || 0);
                const pVal = Number(tx.paid || 0);
                const dVal = Number(tx.balance || 0);
                const rbVal = Number(tx.runningBalance || 0);
                const addressStr = typeof j.address === 'string' ? j.address : `${(j.address as any)?.street || ''}, ${(j.address as any)?.city || ''}`;
                const zebraColor = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
                const statusStyle = inv.status === 'Paid' 
                    ? 'color: #15803d; background-color: #f0fdf4; border: 1px solid #bbf7d0;' 
                    : 'color: #b91c1c; background-color: #fef2f2; border: 1px solid #fecaca;';
                
                return `
                    <tr style="background-color: ${zebraColor};">
                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">${new Date(j.appointmentTime || j.createdAt || '').toLocaleDateString()}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-weight: bold;">#${inv.id || (j.id ? j.id.slice(0, 8) : '—')}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">
                            <strong>${j.locationName || j.customerName || 'Main Address'}</strong><br/>
                            <span style="font-size: 10px; color: #64748b;">${addressStr}</span>
                        </td>
                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-family: monospace;">${j.poNumber || '—'}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: right;">$${tVal.toFixed(2)}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: right;">$${pVal.toFixed(2)}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: right; font-weight: bold; color: ${dVal > 0.01 ? '#dc2626' : '#1e293b'};">$${dVal.toFixed(2)}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: right; font-weight: bold;">$${rbVal.toFixed(2)}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: center;">
                            <span style="display: inline-block; font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 1px 4px; border-radius: 3px; ${statusStyle}">
                                ${inv.status || 'Unpaid'}
                            </span>
                        </td>
                    </tr>
                `;
            }).join('');

            const emailHtml = `
                <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 750px; margin: auto; padding: 30px; border: 1px solid #e2e8f0; color: #1e293b; font-size: 12px; line-height: 1.5; background-color: #ffffff;">
                    <!-- Header Section -->
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
                        <tr>
                            <td>
                                ${orgLogo ? `<img src="${orgLogo}" style="max-height: 52px; max-width: 180px; margin-bottom: 8px; object-fit: contain;" alt="${orgName}"/><br/>` : ''}
                                <h2 style="font-size: 22px; font-weight: 800; color: #123A63; text-transform: uppercase; margin: 0; letter-spacing: -0.5px;">Statement of Account</h2>
                                <p style="margin: 5px 0 0; font-size: 11px; color: #64748b;">Statement Date: ${new Date().toLocaleDateString()} | Statement #: ${statementNumber}</p>
                            </td>
                            <td style="font-size: 11px; color: #475569; text-align: right; line-height: 1.4; vertical-align: top;">
                                <strong style="font-size: 13px; color: #1e293b;">${orgName}</strong><br/>
                                ${orgAddress}<br/>
                                Phone: ${orgPhone} | Email: ${orgEmail}<br/>
                                ${licenseNumber ? `<span style="font-weight: bold; color: #123A63;">License #: ${licenseNumber}</span>` : ''}
                            </td>
                        </tr>
                    </table>
                    
                    <div style="border-bottom: 2px solid #123A63; margin-bottom: 20px;"></div>

                    <!-- Customer & Terms -->
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
                        <tr>
                            <td style="width: 50%; vertical-align: top; padding-right: 15px;">
                                <div style="font-size: 9px; font-weight: 700; color: #123A63; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin-bottom: 6px;">Client Information</div>
                                <p style="margin: 2px 0;"><strong>${customer.name}</strong></p>
                                <p style="margin: 2px 0; color: #334155;">${customer.address || ''}</p>
                            </td>
                            <td style="width: 50%; vertical-align: top; padding-left: 15px;">
                                <div style="font-size: 9px; font-weight: 700; color: #123A63; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin-bottom: 6px;">Account Summary & Terms</div>
                                <p style="margin: 2px 0; color: #334155;">Client Code: <strong>${customer.id.slice(0, 8).toUpperCase()}</strong></p>
                                <p style="margin: 2px 0; color: #334155;">Account Number: <strong>${customer.accountNumber || getOrGenerateAccountNumber(customer)}</strong></p>
                                <p style="margin: 2px 0; color: #334155;">Payment Terms: <strong>${String(customer.paymentTerms || 'Net 30').replace(/_/g, ' ').toUpperCase()}</strong></p>
                                <p style="margin: 2px 0; color: #334155;">Statement Period: <strong>${statementPeriod}</strong></p>
                            </td>
                        </tr>
                    </table>

                    ${customMessage.trim() ? `
                        <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 12px 16px; margin-bottom: 20px; border-radius: 0 8px 8px 0;">
                            <strong style="color: #0369a1; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">Message from ${orgName}:</strong>
                            <p style="margin: 0; color: #1e293b; font-size: 12px; white-space: pre-wrap; line-height: 1.5;">${customMessage.trim()}</p>
                        </div>
                    ` : ''}

                    <p style="color: #334155; margin-bottom: 12px;">Dear Finance Team,</p>
                    <p style="color: #334155; margin-bottom: 20px;">Please find below the corporate Statement of Account for <strong>${customer.name}</strong> summarizing all recent service invoices, payments, and outstanding balances. An official branded vector PDF is attached to this email for your accounting records.</p>

                    <!-- Financial Summary -->
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; border: 1px solid #cbd5e1;">
                        <tr>
                            <th style="background-color: #123A63; color: #ffffff; font-weight: 700; font-size: 9px; text-transform: uppercase; text-align: center; padding: 6px; border: 1px solid #123A63;">Previous Balance</th>
                            <th style="background-color: #123A63; color: #ffffff; font-weight: 700; font-size: 9px; text-transform: uppercase; text-align: center; padding: 6px; border: 1px solid #123A63;">New Charges</th>
                            <th style="background-color: #123A63; color: #ffffff; font-weight: 700; font-size: 9px; text-transform: uppercase; text-align: center; padding: 6px; border: 1px solid #123A63;">Payments Received</th>
                            <th style="background-color: #123A63; color: #ffffff; font-weight: 700; font-size: 9px; text-transform: uppercase; text-align: center; padding: 6px; border: 1px solid #123A63;">Adjustments</th>
                            <th style="background-color: #0f2d50; color: #ffffff; font-weight: 700; font-size: 9px; text-transform: uppercase; text-align: center; padding: 6px; border: 1px solid #0f2d50;">Amount Due</th>
                        </tr>
                        <tr>
                            <td style="padding: 10px; text-align: center; font-size: 13px; font-weight: 700; border: 1px solid #cbd5e1; background-color: #f8fafc;">$0.00</td>
                            <td style="padding: 10px; text-align: center; font-size: 13px; font-weight: 700; border: 1px solid #cbd5e1; background-color: #f8fafc;">$${statementTotals.totalBilled.toFixed(2)}</td>
                            <td style="padding: 10px; text-align: center; font-size: 13px; font-weight: 700; border: 1px solid #cbd5e1; background-color: #f8fafc; color: #16a34a;">-$${statementTotals.totalPaid.toFixed(2)}</td>
                            <td style="padding: 10px; text-align: center; font-size: 13px; font-weight: 700; border: 1px solid #cbd5e1; background-color: #f8fafc;">$0.00</td>
                            <td style="padding: 10px; text-align: center; font-size: 14px; font-weight: 700; border: 1px solid #cbd5e1; background-color: #f1f5f9; color: #dc2626;">$${statementTotals.totalDue.toFixed(2)}</td>
                        </tr>
                    </table>

                    <!-- Transaction Ledger -->
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 25px;">
                        <thead>
                            <tr style="background-color: #123A63;">
                                <th style="color: #ffffff; padding: 8px; text-align: left; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Date</th>
                                <th style="color: #ffffff; padding: 8px; text-align: left; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Invoice #</th>
                                <th style="color: #ffffff; padding: 8px; text-align: left; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Property / Location</th>
                                <th style="color: #ffffff; padding: 8px; text-align: left; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Ref / PO #</th>
                                <th style="color: #ffffff; padding: 8px; text-align: right; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Debit (Dr)</th>
                                <th style="color: #ffffff; padding: 8px; text-align: right; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Credit (Cr)</th>
                                <th style="color: #ffffff; padding: 8px; text-align: right; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Balance</th>
                                <th style="color: #ffffff; padding: 8px; text-align: right; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Running Bal</th>
                                <th style="color: #ffffff; padding: 8px; text-align: center; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #0f2d50;">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${invoiceRows}
                        </tbody>
                    </table>

                    <!-- Aging Summary -->
                    <div style="font-size: 9px; font-weight: 700; color: #123A63; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Aging Analysis (Unpaid Balances)</div>
                    <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; margin-bottom: 35px;">
                        <tr>
                            <th style="background-color: #f1f5f9; color: #475569; font-weight: bold; font-size: 8px; text-transform: uppercase; text-align: center; padding: 5px; border: 1px solid #cbd5e1;">Current</th>
                            <th style="background-color: #f1f5f9; color: #475569; font-weight: bold; font-size: 8px; text-transform: uppercase; text-align: center; padding: 5px; border: 1px solid #cbd5e1;">1 - 30 Days</th>
                            <th style="background-color: #f1f5f9; color: #475569; font-weight: bold; font-size: 8px; text-transform: uppercase; text-align: center; padding: 5px; border: 1px solid #cbd5e1;">31 - 60 Days</th>
                            <th style="background-color: #f1f5f9; color: #475569; font-weight: bold; font-size: 8px; text-transform: uppercase; text-align: center; padding: 5px; border: 1px solid #cbd5e1;">61 - 90 Days</th>
                            <th style="background-color: #f1f5f9; color: #475569; font-weight: bold; font-size: 8px; text-transform: uppercase; text-align: center; padding: 5px; border: 1px solid #cbd5e1;">90+ Days</th>
                            <th style="background-color: #123A63; color: #ffffff; font-weight: bold; font-size: 8px; text-transform: uppercase; text-align: center; padding: 5px; border: 1px solid #cbd5e1;">Total Outstanding</th>
                        </tr>
                        <tr>
                            <td style="padding: 8px; text-align: center; font-size: 11px; font-weight: bold; border: 1px solid #cbd5e1;">$${statementTotals.aging.current.toFixed(2)}</td>
                            <td style="padding: 8px; text-align: center; font-size: 11px; font-weight: bold; border: 1px solid #cbd5e1; color: ${statementTotals.aging.days30 > 0 ? '#b45309' : '#1e293b'};">$${statementTotals.aging.days30.toFixed(2)}</td>
                            <td style="padding: 8px; text-align: center; font-size: 11px; font-weight: bold; border: 1px solid #cbd5e1; color: ${statementTotals.aging.days60 > 0 ? '#b45309' : '#1e293b'};">$${statementTotals.aging.days60.toFixed(2)}</td>
                            <td style="padding: 8px; text-align: center; font-size: 11px; font-weight: bold; border: 1px solid #cbd5e1; color: ${statementTotals.aging.days90 > 0 ? '#dc2626' : '#1e293b'};">$${statementTotals.aging.days90.toFixed(2)}</td>
                            <td style="padding: 8px; text-align: center; font-size: 11px; font-weight: bold; border: 1px solid #cbd5e1; color: ${statementTotals.aging.older > 0 ? '#dc2626' : '#1e293b'};">$${statementTotals.aging.older.toFixed(2)}</td>
                            <td style="padding: 8px; text-align: center; font-size: 11px; font-weight: bold; border: 1px solid #cbd5e1; background-color: #f8fafc; color: #dc2626;">$${statementTotals.totalDue.toFixed(2)}</td>
                        </tr>
                    </table>

                    ${formatPaymentInstructionsHtml(activeOrg)}

                    <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 10px; color: #64748b;">
                        <strong>Corporate Remittance Support:</strong><br/>
                        Please reference Statement #${statementNumber} on your remittance advice. For inquiries, reply directly to this email or contact <strong>${orgEmail || orgPhone}</strong>.<br/>
                        ${licenseNumber ? `<span style="font-size: 9px; display: block; margin-top: 6px;">STATE LICENSE # ${licenseNumber} — ${orgName}</span>` : ''}
                        <span style="font-size: 8px; color: #94a3b8; display: block; margin-top: 6px;">CONFIDENTIALITY DISCLAIMER: This email and any attachments contain confidential proprietary financial information intended solely for the customer named above.</span>
                    </div>
                </div>
            `;

            const normalizedRecipients = recipients.map(r => r.trim().toLowerCase());

            const mailPayload = {
                to: normalizedRecipients,
                attachments: [attachment],
                message: {
                    subject: subject.trim() || `Statement of Account: ${customer.name} - ${statementNumber}`,
                    attachments: [attachment],
                    html: emailHtml,
                    text: `Statement of Account for ${customer.name}. Total Outstanding Balance: $${statementTotals.totalDue.toFixed(2)}. An official PDF statement is attached.${customMessage.trim() ? `\n\nNote from ${orgName}:\n${customMessage.trim()}` : ''}`,
                    replyTo: activeOrg?.email || orgEmail,
                },
                senderUser: state.currentUser,
                type: 'Statement'
            };

            await sendEmail(activeOrg, mailPayload);
            showToast.success(`Statement of Account emailed to ${normalizedRecipients.length} recipient${normalizedRecipients.length === 1 ? '' : 's'}!`);
            onClose();
        } catch (error: any) {
            console.error("Email Statement Error:", error);
            showToast.error("Failed to email Statement of Account: " + (error.message || 'Transmission error'));
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-[#123A63]/10 text-[#123A63] dark:text-sky-400">
                        <Mail size={18} />
                    </span>
                    <div>
                        <div className="font-extrabold text-base text-slate-900 dark:text-white">
                            {t("Email Statement of Account")}
                        </div>
                        <div className="text-xs font-normal text-slate-500 dark:text-slate-400">
                            {customer?.name} &bull; {statementNumber} &bull; Outstanding: <span className="font-bold text-red-600 dark:text-red-400">${(statementTotals?.totalDue || 0).toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            }
            size="lg"
            zIndex={zIndex}
        >
            <div className="space-y-5">
                {/* Recipients Management Card */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                            <Users size={14} className="text-[#123A63] dark:text-sky-400" />
                            {t("Email Recipients")} ({recipients.length})
                        </label>
                        {recipients.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setRecipients([])}
                                className="text-[11px] text-red-600 hover:text-red-700 dark:text-red-400 font-semibold hover:underline"
                            >
                                {t("Clear all")}
                            </button>
                        )}
                    </div>

                    {/* Active Recipients Chips */}
                    <div className="min-h-[44px] p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-wrap gap-1.5 items-center">
                        {recipients.length === 0 ? (
                            <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 px-2 py-1 font-medium">
                                <AlertCircle size={14} />
                                {t("No recipients selected. Please add an email address or select from contacts below.")}
                            </div>
                        ) : (
                            recipients.map((email) => {
                                const meta = getContactMeta(email);
                                return (
                                    <div
                                        key={email}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-900 dark:text-sky-200 border border-sky-200 dark:border-sky-800/80 text-xs font-medium shadow-xs group"
                                    >
                                        <Mail size={12} className="text-sky-600 dark:text-sky-400 shrink-0" />
                                        {meta && meta.name !== email && (
                                            <span className="font-bold text-slate-800 dark:text-slate-100">{meta.name}:</span>
                                        )}
                                        <span className="font-mono text-[11px]">{email}</span>
                                        {meta?.role && (
                                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-200/60 dark:bg-sky-900/60 text-sky-800 dark:text-sky-300 font-bold uppercase">
                                                {meta.role}
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveRecipient(email)}
                                            className="text-sky-400 hover:text-red-600 dark:hover:text-red-400 p-0.5 rounded-full transition-colors ml-0.5"
                                            title={`Remove ${email}`}
                                            aria-label={`Remove ${email}`}
                                        >
                                            <X size={13} />
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Add Custom Email Bar */}
                    <div className="flex gap-2 items-center">
                        <div className="flex-1">
                            <Input
                                type="email"
                                placeholder={t("Type new recipient email address...")}
                                value={newEmailInput}
                                onChange={(e) => setNewEmailInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddCustomEmail();
                                    }
                                }}
                                className="text-xs"
                                isBlock={true}
                            />
                        </div>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={handleAddCustomEmail}
                            className="shrink-0 flex items-center gap-1 text-xs py-2 px-3 border border-slate-300 dark:border-slate-600 font-bold"
                            disabled={!newEmailInput.trim()}
                        >
                            <Plus size={14} /> {t("Add Email")}
                        </Button>
                    </div>

                    {/* Available Customer Contacts (1-Click Toggle Grid) */}
                    {discoveredContacts.length > 0 && (
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                                {t("Customer Contacts on File")}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                {discoveredContacts.map((contact) => {
                                    const isSelected = recipients.some(r => r.toLowerCase() === contact.email.toLowerCase());
                                    return (
                                        <div
                                            key={contact.email}
                                            onClick={() => handleToggleContact(contact.email)}
                                            className={`p-2 rounded-lg border text-left flex items-center justify-between gap-2 cursor-pointer transition-all ${
                                                isSelected
                                                    ? 'bg-emerald-50/80 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-700/80 text-emerald-950 dark:text-emerald-100 shadow-xs'
                                                    : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:hover:border-slate-600 text-slate-800 dark:text-slate-200'
                                            }`}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="font-bold text-xs truncate">{contact.name}</span>
                                                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-tight ${
                                                        contact.source === 'billing' 
                                                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200' 
                                                            : contact.source === 'primary'
                                                            ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200'
                                                            : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                                    }`}>
                                                        {contact.role}
                                                    </span>
                                                </div>
                                                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono mt-0.5">
                                                    {contact.email}
                                                </div>
                                            </div>

                                            <div className="shrink-0">
                                                {isSelected ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                                                        <Check size={11} /> {t("Added")}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold hover:bg-indigo-100 hover:text-indigo-700 transition-colors">
                                                        <Plus size={11} /> {t("Add")}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Email Subject */}
                <div>
                    <Input
                        label={t("Subject Line")}
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="text-xs font-semibold"
                        isBlock={true}
                        required
                    />
                </div>

                {/* Custom Note / Memo */}
                <div>
                    <Textarea
                        label={t("Personalized Memo / Note (Optional - inserted into statement body)")}
                        value={customMessage}
                        onChange={(e) => setCustomMessage(e.target.value)}
                        placeholder={t("e.g., Thank you for your continued business. Please find your updated statement attached. Remittances may be processed via check or online wire...")}
                        rows={3}
                        className="text-xs"
                    />
                </div>

                {/* Attachment Card */}
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                            <FileText size={20} />
                        </div>
                        <div>
                            <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                <span>Statement_{customer?.name ? customer.name.replace(/[^a-zA-Z0-9]/g, '_') : 'Account'}_{statementNumber}.pdf</span>
                                <span className="text-[9px] font-bold px-1.5 py-0.2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
                                    Vector PDF
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {t("Official branded vector statement with repeating headers, aging analysis, and TDLR regulatory compliance.")}
                            </p>
                        </div>
                    </div>
                    <div className="text-right shrink-0">
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <Paperclip size={12} /> {t("Attached")}
                        </span>
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                        disabled={isSending}
                        className="text-xs"
                    >
                        {t("Cancel")}
                    </Button>
                    <Button
                        type="button"
                        variant="primary"
                        onClick={handleSend}
                        disabled={recipients.length === 0 || isSending}
                        isLoading={isSending}
                        className="bg-[#123A63] hover:bg-[#0f2d50] text-white font-bold flex items-center gap-1.5 text-xs shadow-md"
                    >
                        <Send size={14} />
                        {isSending ? t("Sending Statement...") : `${t("Send Statement")} (${recipients.length})`}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default EmailStatementModal;
