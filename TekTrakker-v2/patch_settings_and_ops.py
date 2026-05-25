import os

settings_path = 'src/pages/admin/Settings.tsx'
ops_path = 'src/pages/admin/settings/components/OperationsTab.tsx'

# --- 1. Patch Settings.tsx ---
if os.path.exists(settings_path):
    print("Patching Settings.tsx...")
    with open(settings_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Add states
    old_state = "    const [virtualWorkerEnabled, setVirtualWorkerEnabled] = useState(false);"
    new_state = "    const [virtualWorkerEnabled, setVirtualWorkerEnabled] = useState(false);\n    const [invoicePrefix, setInvoicePrefix] = useState('INV-');\n    const [invoiceStartNumber, setInvoiceStartNumber] = useState('1000');\n    const [proposalPrefix, setProposalPrefix] = useState('PROP-');\n    const [proposalStartNumber, setProposalStartNumber] = useState('1000');"
    if "invoicePrefix" not in content:
        content = content.replace(old_state, new_state)

    # Initialize states in useEffect
    old_effect = "            setVirtualWorkerEnabled(org.virtualWorkerEnabled || false);"
    new_effect = "            setVirtualWorkerEnabled(org.virtualWorkerEnabled || false);\n            setInvoicePrefix(org.invoicePrefix || 'INV-');\n            setInvoiceStartNumber(org.invoiceStartNumber?.toString() || '1000');\n            setProposalPrefix(org.proposalPrefix || 'PROP-');\n            setProposalStartNumber(org.proposalStartNumber?.toString() || '1000');"
    if "setInvoicePrefix" not in content:
        content = content.replace(old_effect, new_effect)

    # Handle save start
    old_save_start = "    const handleSave = async () => {\n        if (!state.currentOrganization) return;\n        setIsSaving(true);"
    new_save_start = """    const handleSave = async () => {
        if (!state.currentOrganization) return;
        setIsSaving(true);
        const prevInvoiceStartNumber = (state.currentOrganization as any).invoiceStartNumber;
        const prevProposalStartNumber = (state.currentOrganization as any).proposalStartNumber;
        const newInvoiceStart = parseInt(invoiceStartNumber) || 1000;
        const newProposalStart = parseInt(proposalStartNumber) || 1000;"""
    if "prevInvoiceStartNumber" not in content:
        content = content.replace(old_save_start, new_save_start)

    # Add to updatedOrgData
    old_org_data = "            virtualWorkerEnabled,"
    new_org_data = """            virtualWorkerEnabled,
            invoicePrefix,
            invoiceStartNumber: newInvoiceStart,
            proposalPrefix,
            proposalStartNumber: newProposalStart,"""
    if "invoiceStartNumber: newInvoiceStart" not in content:
        content = content.replace(old_org_data, new_org_data)

    # Add sequence pointer updates
    old_try_block = "            // Scrub undefined values to prevent Firebase errors"
    new_try_block = """            // If start numbers are modified, adjust the next sequence pointers
            if (prevInvoiceStartNumber === undefined || prevInvoiceStartNumber !== newInvoiceStart) {
                (updatedOrgData as any).nextInvoiceNum = newInvoiceStart;
            }
            if (prevProposalStartNumber === undefined || prevProposalStartNumber !== newProposalStart) {
                (updatedOrgData as any).nextProposalNum = newProposalStart;
            }

            // Scrub undefined values to prevent Firebase errors"""
    if "nextInvoiceNum = newInvoiceStart" not in content:
        content = content.replace(old_try_block, new_try_block)

    # Pass states to OperationsTab
    old_ops_tab = "cardProcessingFeeFlat, setCardProcessingFeeFlat, achProcessingFeeEnabled, setAchProcessingFeeEnabled, achProcessingFeePercent, setAchProcessingFeePercent, achProcessingFeeFlat, setAchProcessingFeeFlat}}"
    new_ops_tab = "cardProcessingFeeFlat, setCardProcessingFeeFlat, achProcessingFeeEnabled, setAchProcessingFeeEnabled, achProcessingFeePercent, setAchProcessingFeePercent, achProcessingFeeFlat, setAchProcessingFeeFlat, invoicePrefix, setInvoicePrefix, invoiceStartNumber, setInvoiceStartNumber, proposalPrefix, setProposalPrefix, proposalStartNumber, setProposalStartNumber}}"
    if "setInvoicePrefix" not in content or "invoicePrefix" not in content or "proposalPrefix" not in content:
        content = content.replace(old_ops_tab, new_ops_tab)
        # Try without spaces too in case of spacing differences
        content = content.replace("cardProcessingFeeFlat, setCardProcessingFeeFlat, achProcessingFeeEnabled, setAchProcessingFeeEnabled, achProcessingFeePercent, setAchProcessingFeePercent, achProcessingFeeFlat, setAchProcessingFeeFlat}}", new_ops_tab)

    with open(settings_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Settings.tsx patched successfully!")

# --- 2. Patch OperationsTab.tsx ---
if os.path.exists(ops_path):
    print("Patching OperationsTab.tsx...")
    with open(ops_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update Props Interface
    old_props_iface = "    achProcessingFeeFlat: string;\n    setAchProcessingFeeFlat: (val: string) => void;\n}"
    new_props_iface = "    achProcessingFeeFlat: string;\n    setAchProcessingFeeFlat: (val: string) => void;\n    invoicePrefix: string;\n    setInvoicePrefix: (val: string) => void;\n    invoiceStartNumber: string;\n    setInvoiceStartNumber: (val: string) => void;\n    proposalPrefix: string;\n    setProposalPrefix: (val: string) => void;\n    proposalStartNumber: string;\n    setProposalStartNumber: (val: string) => void;\n}"
    if "invoicePrefix" not in content:
        content = content.replace(old_props_iface, new_props_iface)

    # 2. Update Props Destructuring
    old_props_destruct = "    achProcessingFeePercent, setAchProcessingFeePercent,\n    achProcessingFeeFlat, setAchProcessingFeeFlat\n}) => {"
    new_props_destruct = "    achProcessingFeePercent, setAchProcessingFeePercent,\n    achProcessingFeeFlat, setAchProcessingFeeFlat,\n    invoicePrefix, setInvoicePrefix,\n    invoiceStartNumber, setInvoiceStartNumber,\n    proposalPrefix, setProposalPrefix,\n    proposalStartNumber, setProposalStartNumber\n}) => {"
    if "invoicePrefix" not in content:
        content = content.replace(old_props_destruct, new_props_destruct)

    # 3. Add Custom Numbering Schemes JSX
    old_ops_jsx = """            <Card>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-emerald-600"><Gavel size={20}/> Government & Pricing</h3>"""
    
    new_ops_jsx = """            <Card>
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-indigo-600">
                    <Zap size={20} /> Custom Document Numbering Schemes
                </h3>
                <p className="text-xs text-slate-500 mb-6 -mt-4 leading-relaxed">
                    Configure custom prefixes and sequence starting numbers for your organization's Invoices and Proposals. Next document pointer will automatically initialize or synchronize if starting numbers change.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Invoice Numbering */}
                    <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
                        <h4 className="font-bold text-slate-800 dark:text-slate-200">Invoice Series</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                id="inv-prefix"
                                label="Prefix (e.g. INV-)"
                                value={invoicePrefix}
                                onChange={e => setInvoicePrefix(e.target.value)}
                            />
                            <Input
                                id="inv-start-num"
                                label="Start Number"
                                type="number"
                                value={invoiceStartNumber}
                                onChange={e => setInvoiceStartNumber(e.target.value)}
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 italic">
                            Next Invoice: <span className="font-bold text-indigo-500">{invoicePrefix}{invoiceStartNumber}</span>
                        </p>
                    </div>

                    {/* Proposal Numbering */}
                    <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
                        <h4 className="font-bold text-slate-800 dark:text-slate-200">Proposal Series</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                id="prop-prefix"
                                label="Prefix (e.g. PROP-)"
                                value={proposalPrefix}
                                onChange={e => setProposalPrefix(e.target.value)}
                            />
                            <Input
                                id="prop-start-num"
                                label="Start Number"
                                type="number"
                                value={proposalStartNumber}
                                onChange={e => setProposalStartNumber(e.target.value)}
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 italic">
                            Next Proposal: <span className="font-bold text-indigo-500">{proposalPrefix}{proposalStartNumber}</span>
                        </p>
                    </div>
                </div>
            </Card>

            <Card>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-emerald-600"><Gavel size={20}/> Government & Pricing</h3>"""

    if "Custom Document Numbering Schemes" not in content:
        content = content.replace(old_ops_jsx, new_ops_jsx)

    with open(ops_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("OperationsTab.tsx patched successfully!")
