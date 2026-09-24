import React, { useState, useMemo } from 'react';
import { X, Printer, Copy, Check, Search, Phone, Mail, MapPin, Wrench, ShieldCheck, Briefcase } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Customer, Job } from '../../types/types';
import { formatPhoneNumber } from '../../lib/utils';
import { showToast } from '../../lib/toast';

interface CommercialReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommercialReferenceModal: React.FC<CommercialReferenceModalProps> = ({
  isOpen,
  onClose
}) => {
  const { state } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);

  const org: any = state.currentOrganization;
  const customersList: Customer[] = (Array.isArray(state.customers) ? state.customers : Object.values(state.customers || [])) as Customer[];
  const jobsList: Job[] = (Array.isArray(state.jobs) ? state.jobs : Object.values(state.jobs || [])) as Job[];

  // Identify commercial customers
  const commercialData = useMemo(() => {
    const commercialCustomers = customersList.filter(c => {
      const isCommercialType = c.customerType === 'Commercial' || c.customerType === 'Property Management';
      const hasBusinessName = Boolean(c.name && (
        c.name.toLowerCase().includes('inc') ||
        c.name.toLowerCase().includes('llc') ||
        c.name.toLowerCase().includes('corp') ||
        c.name.toLowerCase().includes('group') ||
        c.name.toLowerCase().includes('services')
      ));
      return isCommercialType || hasBusinessName;
    });

    return commercialCustomers.map(customer => {
      const relatedJobs = jobsList.filter(j => (j as any).customerId === customer.id || ((j as any).customerName && (j as any).customerName.toLowerCase() === customer.name?.toLowerCase()));
      
      return {
        customer,
        jobs: (relatedJobs as any[]).sort((a, b) => new Date(b.appointmentTime || b.createdAt || 0).getTime() - new Date(a.appointmentTime || a.createdAt || 0).getTime())
      };
    }).sort((a, b) => b.jobs.length - a.jobs.length || (a.customer.name || '').localeCompare(b.customer.name || ''));
  }, [customersList, jobsList]);

  // Filtered by search
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return commercialData;
    const term = searchTerm.toLowerCase();
    return commercialData.filter(({ customer, jobs }) => {
      const nameMatch = customer.name?.toLowerCase().includes(term);
      const cityMatch = customer.city?.toLowerCase().includes(term);
      const emailMatch = customer.email?.toLowerCase().includes(term);
      const scopeMatch = jobs.some(j => ((j.notes?.diagnosis || j.description || j.title || j.jobType || j.serviceType || '') as string).toLowerCase().includes(term));
      return Boolean(nameMatch || cityMatch || emailMatch || scopeMatch);
    });
  }, [commercialData, searchTerm]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyText = () => {
    const lines: string[] = [];
    lines.push(`# ${org?.name || 'Service Provider'} — Commercial Customer Reference Sheet`);
    lines.push(`Contact: ${org?.phone ? formatPhoneNumber(org.phone) : ''} | ${org?.email || ''} | ${org?.website || ''}`);
    lines.push(`Credentials: Licensed & Insured HVAC Contractor | TDLR Compliant`);
    lines.push(`\n---\n`);

    commercialData.forEach(({ customer, jobs }, idx) => {
      lines.push(`### ${idx + 1}. ${customer.name}`);
      lines.push(`- Contact: ${customer.phone ? formatPhoneNumber(customer.phone) : 'N/A'} | ${customer.email || 'N/A'}`);
      lines.push(`- Location: ${customer.address || ''}, ${customer.city || ''}, ${customer.state || ''} ${customer.zip || ''}`);
      if (customer.equipment && customer.equipment.length > 0) {
        lines.push(`- Managed Equipment: ${customer.equipment.length} Units (${customer.equipment.map((e: any) => `${e.brand || ''} ${e.type || 'Unit'}`).filter(Boolean).slice(0, 3).join(', ')}${customer.equipment.length > 3 ? '...' : ''})`);
      }
      
      const scopes = jobs.map(j => {
        const desc = j.description || j.notes?.diagnosis || j.notes?.preRepair || j.title || j.jobType || j.serviceType || 'Commercial HVAC Service';
        const dateStr = j.appointmentTime ? new Date(j.appointmentTime).toLocaleDateString() : '';
        return `  * [${dateStr}] ${j.jobType || j.serviceType || 'Service'}: ${String(desc).replace(/\n/g, ' ').slice(0, 180)}...`;
      });

      if (scopes.length > 0) {
        lines.push(`- Scope of Work Performed (${jobs.length} completed projects):`);
        lines.push(scopes.slice(0, 5).join('\n'));
      } else {
        lines.push(`- Scope of Work: Commercial HVAC Maintenance & Equipment Service.`);
      }
      lines.push('');
    });

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    showToast.success("Reference sheet copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex justify-center items-start p-2 sm:p-4 md:p-6 print:p-0 print:bg-white print:static">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col my-auto max-h-[92vh] print:max-h-none print:border-none print:shadow-none print:rounded-none">
        
        {/* Modal Top Bar - Hidden when printing */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 print:hidden">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl shrink-0">
              <Briefcase size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">Commercial Reference Sheet</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">Live, auto-updating commercial client references & scopes of work</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleCopyText}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 transition-all shadow-md shadow-blue-500/20 cursor-pointer"
            >
              <Printer size={14} />
              <span>Print / PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Search & Filter Bar - Hidden when printing */}
        <div className="px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 print:hidden">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by customer name, city, contact, or service scope..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
            {filteredData.length} Reference{filteredData.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Printable Reference Sheet Content */}
        <div className="p-6 md:p-8 overflow-y-auto space-y-6 text-slate-800 dark:text-slate-200 print:text-black print:p-0 print:overflow-visible">
          
          {/* Header Banner */}
          <div className="border-b border-slate-200 dark:border-slate-700 pb-6 print:border-black">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight print:text-black">
                  {org?.name || 'TekAir Inc.'}
                </h1>
                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 tracking-wider uppercase mt-0.5 print:text-slate-700">
                  Commercial HVAC Reference Sheet & Scope of Work Portfolio
                </p>
              </div>

              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5 sm:text-right print:text-black">
                {org?.address && <p>{org.address.street || org.address}, {org.address.city || org.city || ''} {org.address.state || org.state || ''} {org.address.zip || org.zip || ''}</p>}
                <p className="font-semibold">{org?.phone ? formatPhoneNumber(org.phone) : '(210) 318-4197'} | {org?.email || 'Operations@tekairinc.com'}</p>
                {org?.website && <p className="text-blue-600 dark:text-blue-400 print:text-black">{org.website}</p>}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 print:text-slate-800">
              <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 flex items-center gap-1 print:border-slate-300">
                <ShieldCheck size={13} className="text-emerald-500" /> Licensed & Insured HVAC Contractor
              </span>
              <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 flex items-center gap-1 print:border-slate-300">
                <Check size={13} className="text-blue-500" /> TDLR Compliant
              </span>
              <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 flex items-center gap-1 print:border-slate-300">
                <Check size={13} className="text-indigo-500" /> EPA Section 608 Certified
              </span>
            </div>
          </div>

          {/* Reference List */}
          <div className="space-y-6">
            {filteredData.map(({ customer, jobs }, index) => (
              <div 
                key={customer.id} 
                className="bg-slate-50/50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 transition-all print:bg-white print:border-slate-300 print:p-3 print:break-inside-avoid"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded print:text-black print:bg-slate-100">
                        #{index + 1}
                      </span>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white print:text-black">
                        {customer.name}
                      </h3>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-600 dark:text-slate-400 print:text-black">
                      {customer.phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={12} className="text-slate-400" />
                          {formatPhoneNumber(customer.phone)}
                        </span>
                      )}
                      {customer.email && (
                        <span className="flex items-center gap-1">
                          <Mail size={12} className="text-slate-400" />
                          {customer.email}
                        </span>
                      )}
                      {customer.address && (
                        <span className="flex items-center gap-1">
                          <MapPin size={12} className="text-slate-400" />
                          {customer.address}, {customer.city || ''} {customer.state || ''}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 whitespace-nowrap self-start sm:self-auto">
                    {customer.equipment && customer.equipment.length > 0 && (
                      <span className="bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-1 print:border-slate-300">
                        <Wrench size={12} className="text-indigo-500" /> {customer.equipment.length} Units
                      </span>
                    )}
                    {jobs.length > 0 && (
                      <span className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-900/40 print:text-black print:border-slate-300">
                        {jobs.length} Project{jobs.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Scope of Work Breakdown */}
                <div className="mt-3.5 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 text-xs print:border-slate-300">
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase text-[10px] tracking-wider print:text-black">
                    Scope of Work & Completed Projects:
                  </h4>
                  
                  {jobs.length > 0 ? (
                    <ul className="space-y-1.5 text-slate-600 dark:text-slate-400 print:text-slate-900">
                      {jobs.slice(0, 3).map((job: any) => {
                        const desc = job.description || job.notes?.diagnosis || job.notes?.preRepair || job.title || job.jobType || job.serviceType || 'Commercial HVAC Diagnostic & Maintenance';
                        const dateStr = job.appointmentTime ? new Date(job.appointmentTime).toLocaleDateString() : '';
                        return (
                          <li key={job.id} className="flex items-start gap-1.5 leading-relaxed">
                            <span className="text-blue-500 dark:text-blue-400 font-black mt-0.5">•</span>
                            <span>
                              {dateStr && <strong className="text-slate-800 dark:text-slate-200 print:text-black">[{dateStr}] </strong>}
                              {(job.jobType || job.serviceType || job.title) && (
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  {job.jobType || job.serviceType || job.title}: </span>
                              )}
                              {String(desc).replace(/\n/g, ' ').slice(0, 220)}{String(desc).length > 220 ? '...' : ''}
                            </span>
                          </li>
                        );
                      })}
                      {jobs.length > 3 && (
                        <li className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 pl-3 print:text-black">
                          + {jobs.length - 3} additional commercial service projects completed
                        </li>
                      )}
                    </ul>
                  ) : (
                    <p className="text-slate-500 dark:text-slate-400 italic">
                      Commercial HVAC maintenance and scheduled system support.
                    </p>
                  )}
                </div>
              </div>
            ))}

            {filteredData.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <p className="text-sm">No commercial references matched your search.</p>
              </div>
            )}
          </div>

          {/* Footer Note */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 flex justify-between items-center print:border-slate-300 print:text-slate-700">
            <span>Generated live from TekTrakker Active CRM & Operations Database</span>
            <span>Confidential Commercial Reference Document</span>
          </div>
        </div>
      </div>
    </div>
  );
};
