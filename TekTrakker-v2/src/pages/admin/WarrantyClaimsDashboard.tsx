import React, { useState, useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import { format } from 'date-fns';
import { WarrantyClaim } from 'types';
import { 
  Shield, 
  CheckCircle,
  FileText
} from '@constants';
import {
  Search as SearchIcon,
  Filter as FilterIcon,
  XCircle,
  Clock as ClockIcon,
  AlertCircle,
  PlusCircle
} from 'lucide-react';
import { db } from 'lib/firebase';
import showToast from 'lib/toast';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Textarea from 'components/ui/Textarea';

const WarrantyClaimsDashboard: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const claims = state.warrantyClaims || [];
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | WarrantyClaim['status']>('All');

  // New Claim Modal State
  const [isNewClaimOpen, setIsNewClaimOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newClaim, setNewClaim] = useState<Partial<WarrantyClaim>>({
    status: 'Draft',
    claimType: 'Manufacturer Parts',
    claimDate: new Date().toISOString().split('T')[0]
  });
  const [editingClaim, setEditingClaim] = useState<WarrantyClaim | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, claimId: string, customerId: string) => {
      const file = e.target.files?.[0];
      if (!file || !state.currentOrganization) return;
      if (file.size > 5 * 1024 * 1024) {
          showToast.warn('File too large — must be under 5MB.');
          e.target.value = '';
          return;
      }
      try {
          const { uploadFileToStorage } = await import('lib/storageService');
          const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9.\-_]/g, '') : 'doc.pdf';
          const path = `organizations/${state.currentOrganization.id}/warrantyClaims/${claimId}/${Date.now()}_${safeName}`;
          const downloadUrl = await uploadFileToStorage(path, file);

          const newFile = {
              id: `file-${Date.now()}`,
              organizationId: state.currentOrganization.id,
              parentId: customerId,
              parentType: 'customer',
              fileName: file.name,
              fileType: file.type,
              dataUrl: downloadUrl,
              createdAt: new Date().toISOString(),
              uploadedBy: state.currentUser?.id || 'admin',
              metadata: { category: 'warranty', claimId }
          };
          
          const customer = state.customers.find(c => c.id === customerId);
          if (customer) {
              const updatedFiles = [...(customer.files || []), newFile];
              await db.collection('customers').doc(customerId).update({ files: updatedFiles });
              dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, files: updatedFiles } });
              showToast.success('File uploaded to claim');
          }
      } catch (err) {
          console.error(err);
          showToast.error('Upload failed.');
      }
  };
  
  const handleUpdateClaim = async () => {
      if (!editingClaim) return;
      setIsSubmitting(true);
      try {
          await db.collection('organizations').doc(state.currentOrganization?.id || '').collection('warrantyClaims').doc(editingClaim.id).update(editingClaim);
          dispatch({ type: 'UPDATE_WARRANTY_CLAIM', payload: editingClaim });
          showToast.success('Claim updated.');
          setEditingClaim(null);
      } catch (e) {
          console.error('Error updating claim:', e);
          showToast.error('Failed to update claim.');
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleSaveClaim = async () => {
    if (!newClaim.customerId) {
        showToast.error("Please select a customer.");
        return;
    }
    
    setIsSubmitting(true);
    try {
        const claimId = `claim-${Date.now()}`;
        const claimData: WarrantyClaim = {
            ...newClaim,
            id: claimId,
            organizationId: state.currentOrganization?.id || '',
            createdAt: new Date().toISOString(),
        } as WarrantyClaim;

        await db.collection('organizations').doc(state.currentOrganization?.id || '').collection('warrantyClaims').doc(claimId).set(claimData);
        dispatch({ type: 'ADD_WARRANTY_CLAIM', payload: claimData });
        
        showToast.success("Warranty claim created successfully.");
        setIsNewClaimOpen(false);
        setNewClaim({
            status: 'Draft',
            claimType: 'Manufacturer Parts',
            claimDate: new Date().toISOString().split('T')[0]
        });
    } catch (e) {
        console.error("Error creating claim:", e);
        showToast.error("Failed to create warranty claim.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: WarrantyClaim['status']) => {
    switch (status) {
      case 'Draft': return 'bg-slate-100 text-slate-800 border-slate-200';
      case 'Submitted': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Approved': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Rejected': return 'bg-red-100 text-red-800 border-red-200';
      case 'Part Received': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'Credit Received': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getStatusIcon = (status: WarrantyClaim['status']) => {
    switch (status) {
      case 'Approved': return <CheckCircle size={14} className="mr-1" />;
      case 'Rejected': return <XCircle size={14} className="mr-1" />;
      case 'Credit Received': return <CheckCircle size={14} className="mr-1" />;
      case 'Draft': return <FileText size={14} className="mr-1" />;
      case 'Submitted': return <ClockIcon size={14} className="mr-1" />;
      default: return <AlertCircle size={14} className="mr-1" />;
    }
  };

  // Metrics calculation
  const metrics = useMemo(() => {
    const total = claims.length;
    const active = claims.filter(c => !['Rejected', 'Credit Received'].includes(c.status)).length;
    const pendingCredit = claims.filter(c => c.status === 'Approved').length;
    
    const totalValue = claims.reduce((sum, c) => sum + (c.amountClaimed || 0), 0);
    const receivedValue = claims
      .filter(c => c.status === 'Credit Received')
      .reduce((sum, c) => sum + (c.amountApproved || 0), 0);

    return { total, active, pendingCredit, totalValue, receivedValue };
  }, [claims]);

  // Filtering
  const filteredClaims = useMemo(() => {
    return claims.filter(claim => {
      const customer = state.customers?.find(c => c.id === claim.customerId);
      const equipment = customer?.equipment?.find(e => e.id === claim.equipmentId);
      
      const brand = equipment?.brand || '';
      const model = equipment?.model || '';
      const serial = equipment?.serial || '';

      const matchesSearch = 
        brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        serial.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (claim.rmaNumber && claim.rmaNumber.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = statusFilter === 'All' || claim.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [claims, searchTerm, statusFilter, state.customers]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="text-primary-500" size={32} />
            Warranty Claims
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Manage manufacturer warranties, track part orders, and monitor pending credits.
          </p>
        </div>
        <div className="flex items-center gap-3">
            <Button onClick={() => setIsNewClaimOpen(true)} className="bg-primary-600 hover:bg-primary-700 text-white gap-2">
                <PlusCircle size={18} />
                Add Claim
            </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Active Claims</h3>
          <p className="text-3xl font-black text-slate-900 dark:text-white">{metrics.active}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Pending Credit</h3>
          <p className="text-3xl font-black text-amber-600 dark:text-amber-500">{metrics.pendingCredit}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total Claimed Value</h3>
          <p className="text-3xl font-black text-slate-900 dark:text-white">${metrics.totalValue.toFixed(2)}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total Credit Received</h3>
          <p className="text-3xl font-black text-emerald-600 dark:text-emerald-500">${metrics.receivedValue.toFixed(2)}</p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by Mfr, Serial, Model, RMA..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <FilterIcon className="text-slate-400" size={18} />
          <select 
            title="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="flex-1 sm:w-auto border border-slate-300 dark:border-slate-600 rounded-lg py-2 pl-3 pr-8 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="All">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Submitted">Submitted</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Part Received">Part Received</option>
            <option value="Credit Received">Credit Received</option>
          </select>
        </div>
      </div>

      {/* Claims Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-900/50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Equipment
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  MFR / Serial
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Dates
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Value
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
              {filteredClaims.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    <Shield className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
                    <p className="text-lg font-medium">No warranty claims found</p>
                    <p className="text-sm mt-1">Adjust filters or create a new claim to see data here.</p>
                  </td>
                </tr>
              ) : (
                filteredClaims.map((claim) => {
                  const customer = state.customers?.find(c => c.id === claim.customerId);
                  const equipment = customer?.equipment?.find(e => e.id === claim.equipmentId);
                  
                  return (
                  <tr key={claim.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer" onClick={() => setEditingClaim(claim as WarrantyClaim)}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-slate-900 dark:text-white">{equipment?.model || 'Unknown Model'}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">RMA: {claim.rmaNumber || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900 dark:text-white">{equipment?.brand || 'Unknown MFR'}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">SN: {equipment?.serial || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(claim.status)}`}>
                        {getStatusIcon(claim.status)}
                        {claim.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                      <div><span className="font-medium text-slate-700 dark:text-slate-300">Created:</span> {claim.createdAt ? format(new Date(claim.createdAt), 'MMM d, yyyy') : 'N/A'}</div>
                      {claim.claimDate && (
                        <div><span className="font-medium text-slate-700 dark:text-slate-300">Claim Date:</span> {format(new Date(claim.claimDate), 'MMM d, yyyy')}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="text-slate-900 dark:text-white">${(claim.amountClaimed || 0).toFixed(2)}</div>
                      {claim.status === 'Credit Received' && (
                        <div className="text-emerald-600 dark:text-emerald-500 text-xs mt-1">
                          Received: ${(claim.amountApproved || 0).toFixed(2)}
                        </div>
                      )}
                    </td>
                  </tr>
                )})
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Edit Claim Modal */}
      {editingClaim && (
          <Modal isOpen={!!editingClaim} onClose={() => setEditingClaim(null)} title="Edit Warranty Claim" size="lg">
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                        label="Status"
                        value={editingClaim.status || 'Draft'}
                        onChange={(e) => setEditingClaim({...editingClaim, status: e.target.value as WarrantyClaim['status']})}
                    >
                        <option value="Draft">Draft</option>
                        <option value="Submitted">Submitted</option>
                        <option value="Approved">Approved</option>
                        <option value="Rejected">Rejected</option>
                        <option value="Part Received">Part Received</option>
                        <option value="Credit Received">Credit Received</option>
                    </Select>
                    <Select
                        label="Claim Type"
                        value={editingClaim.claimType || 'Manufacturer Parts'}
                        onChange={(e) => setEditingClaim({...editingClaim, claimType: e.target.value as WarrantyClaim['claimType']})}
                    >
                        <option value="Manufacturer Parts">Manufacturer Parts</option>
                        <option value="Manufacturer Labor">Manufacturer Labor</option>
                        <option value="In-House Workmanship">In-House Workmanship</option>
                    </Select>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                        type="number"
                        label="Amount Claimed ($)"
                        value={editingClaim.amountClaimed?.toString() || ''}
                        onChange={(e) => setEditingClaim({...editingClaim, amountClaimed: parseFloat(e.target.value) || 0})}
                    />
                    <Input
                        type="number"
                        label="Amount Approved ($)"
                        value={editingClaim.amountApproved?.toString() || ''}
                        onChange={(e) => setEditingClaim({...editingClaim, amountApproved: parseFloat(e.target.value) || 0})}
                    />
                </div>

                <Input
                    label="RMA Number"
                    value={editingClaim.rmaNumber || ''}
                    onChange={(e) => setEditingClaim({...editingClaim, rmaNumber: e.target.value})}
                />

                <Textarea
                    label="Notes"
                    value={editingClaim.notes || ''}
                    onChange={(e) => setEditingClaim({...editingClaim, notes: e.target.value})}
                    rows={3}
                />

                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="font-bold text-slate-800 dark:text-slate-200">Claim Documents</h4>
                        <label className="cursor-pointer bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/40 px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-2 border border-primary-200 dark:border-primary-800">
                            <PlusCircle size={16} />
                            Upload Document
                            <input type="file" onChange={(e) => handleFileUpload(e, editingClaim.id, editingClaim.customerId)} className="hidden" accept="image/*,application/pdf" />
                        </label>
                    </div>
                    
                    <div className="space-y-2">
                        {(() => {
                            const customer = state.customers.find(c => c.id === editingClaim.customerId);
                            const claimFiles = (customer?.files || []).filter((f: any) => f.metadata?.claimId === editingClaim.id || (f.metadata?.category === 'warranty' && !f.metadata?.claimId));
                            
                            if (claimFiles.length === 0) return <p className="text-xs text-slate-500 italic">No documents attached to this claim.</p>;
                            
                            return claimFiles.map((file: any) => (
                                <div key={file.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center gap-2">
                                        <FileText size={16} className="text-slate-400" />
                                        <span className="text-sm text-slate-700 dark:text-slate-300">{file.fileName}</span>
                                    </div>
                                    <a href={file.dataUrl || file.url} target="_blank" rel="noreferrer" className="text-xs text-primary-600 hover:underline">View</a>
                                </div>
                            ));
                        })()}
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <Button variant="secondary" onClick={() => setEditingClaim(null)}>Cancel</Button>
                    <Button onClick={handleUpdateClaim} disabled={isSubmitting}>
                        {isSubmitting ? 'Saving...' : 'Update Claim'}
                    </Button>
                </div>
            </div>
          </Modal>
      )}

      {/* New Claim Modal */}
      <Modal isOpen={isNewClaimOpen} onClose={() => setIsNewClaimOpen(false)} title="Add Warranty Claim" size="lg">
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                    label="Customer"
                    value={newClaim.customerId || ''}
                    onChange={(e) => {
                        const customer = state.customers?.find(c => c.id === e.target.value);
                        setNewClaim({
                            ...newClaim, 
                            customerId: e.target.value, 
                            customerName: customer ? customer.name : '',
                            equipmentId: '' // Reset equipment when customer changes
                        });
                    }}
                >
                    <option value="">Select a customer...</option>
                    {(state.customers || []).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </Select>
                <Select
                    label="Equipment"
                    value={newClaim.equipmentId || ''}
                    onChange={(e) => setNewClaim({...newClaim, equipmentId: e.target.value})}
                    disabled={!newClaim.customerId}
                >
                    <option value="">Select equipment...</option>
                    {(state.customers?.find(c => c.id === newClaim.customerId)?.equipment || []).map(eq => (
                        <option key={eq.id} value={eq.id}>{`${eq.brand} ${eq.model} (SN: ${eq.serial})`}</option>
                    ))}
                </Select>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select
                    label="Status"
                    value={newClaim.status || 'Draft'}
                    onChange={(e) => setNewClaim({...newClaim, status: e.target.value as WarrantyClaim['status']})}
                >
                    <option value="Draft">Draft</option>
                    <option value="Submitted">Submitted</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Part Received">Part Received</option>
                    <option value="Credit Received">Credit Received</option>
                </Select>
                <Select
                    label="Claim Type"
                    value={newClaim.claimType || 'Manufacturer Parts'}
                    onChange={(e) => setNewClaim({...newClaim, claimType: e.target.value as WarrantyClaim['claimType']})}
                >
                    <option value="Manufacturer Parts">Manufacturer Parts</option>
                    <option value="Manufacturer Labor">Manufacturer Labor</option>
                    <option value="In-House Workmanship">In-House Workmanship</option>
                </Select>
                <Input
                    type="date"
                    label="Claim Date"
                    value={newClaim.claimDate || ''}
                    onChange={(e) => setNewClaim({...newClaim, claimDate: e.target.value})}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                    type="number"
                    label="Amount Claimed ($)"
                    value={newClaim.amountClaimed?.toString() || ''}
                    onChange={(e) => setNewClaim({...newClaim, amountClaimed: parseFloat(e.target.value) || 0})}
                />
                <Input
                    label="RMA Number"
                    value={newClaim.rmaNumber || ''}
                    onChange={(e) => setNewClaim({...newClaim, rmaNumber: e.target.value})}
                />
            </div>

            <Textarea
                label="Notes"
                value={newClaim.notes || ''}
                onChange={(e) => setNewClaim({...newClaim, notes: e.target.value})}
                rows={3}
            />

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <Button variant="secondary" onClick={() => setIsNewClaimOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveClaim} disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Save Claim'}
                </Button>
            </div>
        </div>
      </Modal>
    </div>
  );
};

export default WarrantyClaimsDashboard;
