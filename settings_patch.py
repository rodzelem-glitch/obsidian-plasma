import sys

path = 'src/pages/admin/Settings.tsx'
with open(path, 'r') as f:
    content = f.read()

# 1. Update activeTab type and state
content = content.replace(
    "const [activeTab, setActiveTab] = useState<\'profile\' | \'social\' | \'operations\' | \'legal\' | \'integrations\' | \'branding\' | \'subscription\' | \'data\'>(\'profile\');",
    "const [activeTab, setActiveTab] = useState<\'profile\' | \'partners\' | \'social\' | \'operations\' | \'legal\' | \'integrations\' | \'branding\' | \'subscription\' | \'data\'>(\'profile\');"
)

# 2. Add Partner state variables
if "const [partnerIdInput, setPartnerIdInput] = useState('');" not in content:
    content = content.replace(
        "const [industry, setIndustry] = useState<IndustryVertical>('HVAC');",
        "const [industry, setIndustry] = useState<IndustryVertical>('HVAC');\\n    const [partnerIdInput, setPartnerIdInput] = useState('');\\n    const [isSearchingPartner, setIsSearchingPartner] = useState(false);"
    )

# 3. Add Partner functions
partner_funcs = """
    const handleSendPartnerRequest = async () => {
        if (!partnerIdInput || !state.currentOrganization) return;
        if (partnerIdInput === state.currentOrganization.id) { alert("You cannot partner with yourself."); return; }
        
        setIsSearchingPartner(true);
        try {
            const partnerDoc = await db.collection('organizations').doc(partnerIdInput).get();
            if (!partnerDoc.exists) {
                alert("Organization ID not found. Ensure the subcontractor gave you their correct ID from their settings page.");
                return;
            }

            const partnerData = partnerDoc.data() as Organization;
            const requests = partnerData.partnerRequests || [];
            
            if (requests.some(r => r.fromOrgId === state.currentOrganization!.id)) {
                alert("Request already pending with this partner.");
                return;
            }

            await db.collection('organizations').doc(partnerIdInput).update({
                partnerRequests: [...requests, { fromOrgId: state.currentOrganization.id, fromOrgName: state.currentOrganization.name, status: 'pending' }]
            });

            alert(`Partner request sent to ${partnerData.name}!`);
            setPartnerIdInput('');
        } catch (e) { alert("Request failed."); }
        finally { setIsSearchingPartner(false); }
    };

    const handleAcceptPartner = async (reqOrgId: string) => {
        if (!state.currentOrganization) return;
        try {
            const myId = state.currentOrganization.id;
            const myCurrentPartners = state.currentOrganization.linkedPartners || [];
            const myCurrentRequests = state.currentOrganization.partnerRequests || [];

            await db.collection('organizations').doc(myId).update({
                linkedPartners: [...myCurrentPartners, reqOrgId],
                partnerRequests: myCurrentRequests.filter(r => r.fromOrgId !== reqOrgId)
            });

            const otherOrgDoc = await db.collection('organizations').doc(reqOrgId).get();
            const otherPartners = (otherOrgDoc.data() as Organization).linkedPartners || [];
            await db.collection('organizations').doc(reqOrgId).update({
                linkedPartners: [...otherPartners, myId]
            });

            alert("Partner Handshake Complete! You can now dispatch jobs to each other.");
        } catch (e) { alert("Failed to accept."); }
    };
"""
if "handleSendPartnerRequest" not in content:
    content = content.replace(
        "const handleSave = async () => {",
        partner_funcs + "\\n    const handleSave = async () => {"
    )

# 4. Add Tab Button
partner_tab_btn = "{ id: \'partners\', label: \'Partner Network\', icon: Handshake },"
if "'partners'" not in content:
    content = content.replace(
        "{ id: \'social\', label: \'Social & Reviews\', icon: Globe },",
        "{ id: \'social\', label: \'Social & Reviews\', icon: Globe },\\n                    { id: \'partners\', label: \'Partner Network\', icon: Handshake },"
    )

# 5. Add Tab Content
partner_jsx = """
                {activeTab === 'partners' && (
                    <div className="space-y-6">
                        <Card className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white border-0 shadow-xl">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 bg-white/20 rounded-2xl"><Handshake size={32}/></div>
                                <div>
                                    <h3 className="text-xl font-bold">Partner Network</h3>
                                    <p className="text-sm opacity-80">Link with other TekTrakker companies to sub-out work seamlessly.</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Input 
                                    placeholder="Enter Partner Org ID..." 
                                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50" 
                                    value={partnerIdInput} 
                                    onChange={e => setPartnerIdInput(e.target.value)}
                                />
                                <Button onClick={handleSendPartnerRequest} disabled={isSearchingPartner} className="bg-white text-indigo-700 hover:bg-white/90 w-auto font-bold px-6">
                                    {isSearchingPartner ? 'Searching...' : 'Send Link Request'}
                                </Button>
                            </div>
                        </Card>

                        {state.currentOrganization?.partnerRequests && state.currentOrganization.partnerRequests.length > 0 && (
                            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/10">
                                <h4 className="font-bold text-amber-800 dark:text-amber-400 mb-4 flex items-center gap-2">
                                    <AlertTriangle size={18}/> Incoming Link Requests
                                </h4>
                                <div className="space-y-3">
                                    {state.currentOrganization.partnerRequests.map(req => (
                                        <div key={req.fromOrgId} className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 rounded-lg border shadow-sm">
                                            <div>
                                                <p className="font-bold text-sm">{req.fromOrgName}</p>
                                                <p className="text-[10px] text-slate-500 font-mono">ID: {req.fromOrgId}</p>
                                            </div>
                                            <Button onClick={() => handleAcceptPartner(req.fromOrgId)} className="h-8 text-xs w-auto bg-green-600">Accept Link</Button>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        )}

                        <Card>
                            <h4 className="font-bold mb-4">Connected Subcontractors / Partners</h4>
                            <div className="space-y-3">
                                {state.currentOrganization?.linkedPartners?.map(pId => (
                                    <div key={pId} className="flex justify-between items-center p-4 border rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg"><Building size={20}/></div>
                                            <div>
                                                <p className="font-bold">{pId}</p>
                                                <p className="text-[10px] text-green-600 font-bold uppercase tracking-widest flex items-center gap-1"><CheckCircle2 size={10}/> Linked & Active</p>
                                            </div>
                                        </div>
                                        <Button variant="secondary" className="w-auto h-8 text-xs text-red-600 border-red-100 hover:bg-red-50">Disconnect</Button>
                                    </div>
                                )) || <p className="text-center text-slate-400 text-sm py-10 italic">No partners connected yet. Share your Org ID to get started.</p>}
                            </div>
                        </Card>
                    </div>
                )}
"""
if "activeTab === 'partners'" not in content:
    content = content.replace(
        "{activeTab === 'profile' && (",
        partner_jsx + "\\n                {activeTab === 'profile' && ("
    )

# New: Add Handshake and AlertTriangle to lucide-react import
content = content.replace(
    "import { \\n    Building, Globe, Activity, Scale, CreditCard, Palette, Zap, Database\\n} from \'lucide-react\';",
    "import { \\n    Building, Globe, Activity, Scale, CreditCard, Palette, Zap, Database, Handshake, AlertTriangle \\n} from \'lucide-react\';"
)

with open(path, 'w') as f:
    f.write(content)

# Now, let\'s address the second part: adding the button to the CustomerMasterModal.tsx
customer_modal_path = 'src/components/modals/CustomerMasterModal.tsx'

# Read the file
with open(customer_modal_path, 'r') as f:
    customer_modal_content = f.read()

# Add a state for the JobAppointmentModal and a handler
new_state_and_handler = """
    const [isJobAppointmentModalOpen, setIsJobAppointmentModalOpen] = useState(false);

    const handleBookAppointmentClick = () => {
        setIsJobAppointmentModalOpen(true);
    };
"""

if "isJobAppointmentModalOpen" not in customer_modal_content:
    customer_modal_content = customer_modal_content.replace(
        "const [isEditing, setIsEditing] = useState(false);",
        "const [isEditing, setIsEditing] = useState(false);" + new_state_and_handler
    )

# Add the import for JobAppointmentModal
if "import JobAppointmentModal from '../../components/modals/JobAppointmentModal';" not in customer_modal_content:
    customer_modal_content = customer_modal_content.replace(
        "import Modal from '../ui/Modal';",
        "import Modal from '../ui/Modal';\nimport JobAppointmentModal from '../../components/modals/JobAppointmentModal';"
    )

# Add the \"Book an Appointment\" button to the modal footer
button_to_add = """
                    <Button 
                        onClick={handleBookAppointmentClick} 
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                    >
                        Book an Appointment
                    </Button>
"""

# Find a suitable place to insert the button, e.g., before the \"Save Changes\" button or at the end of the footer
# Assuming the footer has a div with class \"flex justify-end gap-2\"
if "Book an Appointment" not in customer_modal_content:
    customer_modal_content = customer_modal_content.replace(
        '<div className="flex justify-end gap-2 pt-4">',
        '<div className="flex justify-end gap-2 pt-4">' + button_to_add
    )

# Add the JobAppointmentModal component
job_appointment_modal_component = """
            <JobAppointmentModal 
                isOpen={isJobAppointmentModalOpen} 
                onClose={() => setIsJobAppointmentModalOpen(false)} 
                customer={customer} 
            />
"""

if "JobAppointmentModal" not in customer_modal_content:
    # Find a good place to insert the modal, usually before the closing </Modal> tag of the main modal
    customer_modal_content = customer_modal_content.replace(
        '</Modal>',
        job_appointment_modal_component + '\n        </Modal>'
    )

# Write the modified content back to the file
with open(customer_modal_path, 'w') as f:
    f.write(customer_modal_content)

print(f"Updated {path} and {customer_modal_path}")