import React, { useState, useEffect } from 'react';
import Button from 'components/ui/Button';
import { db } from 'lib/firebase';
import { Database, Sparkles, Tag, Plus, Trash2, Check, X, Loader2, Calendar } from 'lucide-react';
import Card from 'components/ui/Card';
import Input from 'components/ui/Input';
import Table from 'components/ui/Table';
import { globalConfirm } from "lib/globalConfirm";

const DataSeedingActions: React.FC<{ hidePromoMaker?: boolean }> = ({ hidePromoMaker = false }) => {
    const [seeding, setSeeding] = useState(false);
    const [promoCodes, setPromoCodes] = useState<any[]>([]);
    const [loadingPromos, setLoadingPromos] = useState(false);
    
    const [newCode, setNewCode] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [durationMonths, setDurationMonths] = useState('12');

    useEffect(() => {
        if (!hidePromoMaker) {
            fetchPromoCodes();
        }
    }, [hidePromoMaker]);

    const fetchPromoCodes = async () => {
        setLoadingPromos(true);
        try {
            const snap = await db.collection('promoCodes').get();
            setPromoCodes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (e) {
            console.error("Fetch promos failed", e);
        } finally {
            setLoadingPromos(false);
        }
    };

    const handleAddPromo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCode.trim()) return;
        setSeeding(true);
        try {
            await db.collection('promoCodes').add({
                code: newCode.trim().toUpperCase(),
                description: newDesc || 'Manual Entry',
                durationMonths: parseInt(durationMonths) || 12,
                isActive: true,
                createdAt: new Date().toISOString()
            });
            setNewCode('');
            setNewDesc('');
            setDurationMonths('12');
            fetchPromoCodes();
        } catch (e: any) {
            alert("Error: " + e.message);
        } finally {
            setSeeding(false);
        }
    };

    const handleTogglePromo = async (id: string, current: boolean) => {
        try {
            await db.collection('promoCodes').doc(id).update({ isActive: !current });
            fetchPromoCodes();
        } catch (e) {}
    };

    const handleDeletePromo = async (id: string) => {
        if (!await globalConfirm("Delete this promo code?")) return;
        try {
            await db.collection('promoCodes').doc(id).delete();
            fetchPromoCodes();
        } catch (e) {}
    };

    const handleSeedData = async () => {
        if (!await globalConfirm("This will create 3 Test Organizations, 12 Employees, and 30 Customers in your database. Continue?")) return;
        setSeeding(true);
        try {
            const batch = db.batch();
            const now = new Date();

            for (let i = 1; i <= 3; i++) {
                const orgId = `test-org-${Date.now()}-${i}`;
                const orgRef = db.collection('organizations').doc(orgId);
                
                batch.set(orgRef, {
                    id: orgId,
                    name: `Test Org ${i} - ${['HVAC Specialists', 'Premier Plumbing', 'Elite Electric'][i-1]}`,
                    phone: `(555) 010-${1000 + i}`,
                    email: `admin${i}@testorg.com`,
                    subscriptionStatus: 'active',
                    plan: i === 1 ? 'starter' : i === 2 ? 'growth' : 'enterprise',
                    subscriptionExpiryDate: new Date(new Date().setFullYear(now.getFullYear() + 1)).toISOString().split('T')[0],
                    createdAt: now.toISOString(),
                    enabledPanels: {
                        inventory: true,
                        marketing: true,
                        memberships: true,
                        documents: true,
                        time_tracking: true
                    }
                });

                for (let j = 1; j <= 4; j++) {
                    const userId = `test-user-${orgId}-${j}`;
                    const userRef = db.collection('users').doc(userId);
                    const isSupervisor = j === 1;
                    
                    batch.set(userRef, {
                        id: userId,
                        uid: userId,
                        organizationId: orgId,
                        firstName: ['Mike', 'Sarah', 'David', 'Jessica', 'Robert', 'Emily'][j-1] || `Tech${j}`,
                        lastName: `Smith ${i}`,
                        email: `tech${i}-${j}@testorg.com`,
                        role: isSupervisor ? 'supervisor' : 'employee',
                        username: `tech${i}-${j}`,
                        payRate: 25 + (j * 2),
                        status: 'active',
                        hireDate: now.toISOString(),
                        ptoAccrued: 10,
                        preferences: { theme: 'dark' }
                    });
                }

                const streets = ['Maple', 'Oak', 'Pine', 'Cedar', 'Elm', 'Main', 'First', 'Second', 'Third', 'Fourth'];
                for (let k = 1; k <= 10; k++) {
                    const custId = `test-cust-${orgId}-${k}`;
                    const custRef = db.collection('customers').doc(custId);
                    batch.set(custRef, {
                        id: custId,
                        organizationId: orgId,
                        name: `Customer ${i}-${k}`,
                        firstName: `Customer`,
                        lastName: `${i}-${k}`,
                        email: `customer${i}-${k}@example.com`,
                        phone: `(555) 09${i}-${1000 + k}`,
                        address: `${100 + k} ${streets[k-1] || 'Main'} St, Test City, TX 7870${i}`,
                        customerType: k % 3 === 0 ? 'Commercial' : 'Residential',
                        hvacSystem: { 
                            brand: ['Trane', 'Carrier', 'Lennox', 'Rheem'][k % 4], 
                            type: 'Split System',
                            installDate: '2020-01-01'
                        },
                        serviceHistory: []
                    });
                }
            }

            await batch.commit();
            alert("Test data seeded successfully! You can now Impersonate these organizations to view their data.");
            window.location.reload(); 
        } catch (e: any) {
            console.error(e);
            alert("Error seeding data: " + e.message);
        } finally {
            setSeeding(false);
        }
    };

    const handleSeedDemoSuite = async () => {
        if (!await globalConfirm("Create a high-performance 'Apex Demo' organization? This will generate extensive historical revenue data, contracts, compliance logs, and more.")) return;
        setSeeding(true);
        try {
            let currentBatch = db.batch();
            let opCount = 0;
            
            const commitAndReset = async () => {
                await currentBatch.commit();
                currentBatch = db.batch();
                opCount = 0;
            };

            const safeSet = async (ref: any, data: any) => {
                currentBatch.set(ref, data);
                opCount++;
                if (opCount >= 450) await commitAndReset();
            };

            const now = new Date();
            const orgId = `demo-org-${Date.now()}`;
            
            const orgRef = db.collection('organizations').doc(orgId);
            await safeSet(orgRef, {
                id: orgId,
                name: 'Apex Service Solutions (Demo)',
                phone: '(555) 012-3456',
                email: 'demo@apexservices.com',
                website: 'https://apexservices.demo',
                address: '100 Innovation Dr',
                city: 'Austin',
                state: 'TX',
                zip: '78701',
                industry: 'HVAC',
                subscriptionStatus: 'active',
                plan: 'enterprise',
                subscriptionExpiryDate: '2099-12-31',
                createdAt: now.toISOString(),
                primaryColor: '#0ea5e9',
                marketMultiplier: 1.2,
                enabledPanels: { inventory: true, marketing: true, memberships: true, documents: true, time_tracking: true }
            });

            const users = [
                { name: 'Demo Admin', role: 'both', email: 'admin@apexservices.com' },
                { name: 'Mike Technic', role: 'employee', email: 'mike@apexservices.com' },
                { name: 'Sarah Sales', role: 'both', email: 'sarah@apexservices.com' },
                { name: 'Jake Install', role: 'employee', email: 'jake@apexservices.com' }
            ];

            const userIds: string[] = [];

            for (let idx = 0; idx < users.length; idx++) {
                const u = users[idx];
                const uid = `demo-user-${orgId}-${idx}`;
                userIds.push(uid);
                const uRef = db.collection('users').doc(uid);
                await safeSet(uRef, {
                    id: uid,
                    uid: uid,
                    organizationId: orgId,
                    firstName: u.name.split(' ')[0],
                    lastName: u.name.split(' ')[1],
                    email: u.email,
                    role: u.role,
                    username: u.name.toLowerCase().replace(' ', ''),
                    status: 'active',
                    payRate: 35,
                    ptoAccrued: 40,
                    preferences: { theme: 'light' },
                    hireDate: new Date(now.getFullYear() - 2, 0, 1).toISOString()
                });
            }

            const customerIds: string[] = [];
            const firstNames = ['James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda', 'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen'];
            const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
            
            for (let idx = 0; idx < 50; idx++) {
                const cid = `demo-cust-${orgId}-${idx}`;
                customerIds.push(cid);
                const fn = firstNames[idx % firstNames.length];
                const ln = lastNames[idx % lastNames.length] + (idx > 20 ? `-${idx}` : '');
                const name = `${fn} ${ln}`;
                
                const cRef = db.collection('customers').doc(cid);
                await safeSet(cRef, {
                    id: cid,
                    organizationId: orgId,
                    name: name,
                    firstName: fn,
                    lastName: ln,
                    email: `${fn.toLowerCase()}.${ln.toLowerCase()}@example.com`,
                    phone: `(555) ${100 + idx}-${1000 + idx}`,
                    address: `${100 + idx} Maple Ave, Austin, TX 78701`,
                    customerType: idx % 5 === 0 ? 'Commercial' : 'Residential',
                    hvacSystem: { 
                        brand: ['Trane', 'Carrier', 'Lennox', 'Rheem', 'York'][idx % 5], 
                        type: 'Split System',
                        installDate: '2019-06-15'
                    },
                    serviceHistory: []
                });
            }

            const items = [
                { name: 'R410A Refrigerant', sku: 'REF-410', cat: 'Consumables', cost: 350, price: 900, qty: 10 },
                { name: 'Contactor 2-Pole', sku: 'EL-CON-2P', cat: 'Parts', cost: 12, price: 145, qty: 25 },
                { name: 'Capacitor 45/5', sku: 'EL-CAP-455', cat: 'Parts', cost: 8, price: 125, qty: 30 },
                { name: 'Hard Start Kit', sku: 'EL-HSK', cat: 'Parts', cost: 25, price: 285, qty: 15 },
                { name: 'Filter 20x20x1', sku: 'FIL-2020', cat: 'Consumables', cost: 4, price: 25, qty: 50 },
                { name: 'Pro Series Thermostat', sku: 'TST-PRO', cat: 'Equipment', cost: 80, price: 250, qty: 8 }
            ];
            
            for (let idx = 0; idx < items.length; idx++) {
                const item = items[idx];
                const iId = `demo-inv-${orgId}-${idx}`;
                const iRef = db.collection('inventory').doc(iId);
                await safeSet(iRef, {
                    id: iId,
                    organizationId: orgId,
                    name: item.name,
                    sku: item.sku,
                    category: item.cat,
                    cost: item.cost,
                    price: item.price,
                    quantity: item.qty,
                    minQuantity: 5,
                    location: 'Warehouse',
                    lastUpdated: now.toISOString()
                });
            }

            const campName = 'Summer Tune-Up Special';
            const campId = `demo-camp-${orgId}`;
            await safeSet(db.collection('campaigns').doc(campId), {
                id: campId,
                organizationId: orgId,
                name: campName,
                platform: 'Google Ads',
                status: 'Active',
                spend: 2500,
                startDate: new Date(now.getTime() - 7776000000).toISOString(),
                impressions: 15400,
                clicks: 850
            });

            const historyMonths = 6;
            const jobsPerMonth = 15;
            
            for (let m = 0; m < historyMonths; m++) {
                for (let j = 0; j < jobsPerMonth; j++) {
                    const isBigJob = j % 8 === 0;
                    const isCampaignJob = j % 5 === 0;
                    const pastDate = new Date();
                    pastDate.setMonth(pastDate.getMonth() - m);
                    pastDate.setDate(Math.floor(Math.random() * 28) + 1);
                    pastDate.setHours(8 + Math.floor(Math.random() * 8), 0, 0);

                    const custIdx = Math.floor(Math.random() * customerIds.length);
                    const techIdx = Math.floor(Math.random() * userIds.length);
                    
                    const amount = isBigJob 
                        ? 8500 + Math.floor(Math.random() * 5000)
                        : 250 + Math.floor(Math.random() * 600);

                    const jobType = isBigJob ? 'System Installation' : 'Service Repair';
                    const items = isBigJob 
                        ? [{ description: 'Complete System Install (16 SEER)', quantity: 1, unitPrice: amount, total: amount, type: 'Part' }]
                        : [{ description: 'Diagnostic', quantity: 1, unitPrice: 89, total: 89, type: 'Labor' }, { description: 'Repair Parts', quantity: 1, unitPrice: amount - 89, total: amount - 89, type: 'Part' }];

                    const histJobId = `job-hist-${orgId}-${m}-${j}`;
                    const histJobRef = db.collection('jobs').doc(histJobId);
                    
                    await safeSet(histJobRef, {
                        id: histJobId,
                        organizationId: orgId,
                        customerId: customerIds[custIdx],
                        customerName: `${firstNames[custIdx % firstNames.length]} ${lastNames[custIdx % lastNames.length]}`,
                        address: `${100 + custIdx} Maple Ave, Austin, TX 78701`,
                        tasks: [jobType],
                        jobStatus: 'Completed',
                        appointmentTime: pastDate.toISOString(),
                        assignedTechnicianId: userIds[techIdx],
                        assignedTechnicianName: users[techIdx].name,
                        source: isCampaignJob ? campName : 'Referral',
                        invoice: {
                            id: `INV-${Date.now()}-${m}-${j}`,
                            status: 'Paid',
                            amount: amount,
                            totalAmount: amount,
                            subtotal: amount,
                            taxAmount: 0,
                            items: items
                        },
                        jobEvents: [{ type: 'Arrived', timestamp: pastDate.toISOString() }],
                        createdAt: pastDate.toISOString()
                    });

                    if (j % 2 === 0) { 
                        const expId = `exp-hist-${orgId}-${m}-${j}`;
                        const expRef = db.collection('expenses').doc(expId);
                        const expAmount = amount * (isBigJob ? 0.45 : 0.2); 
                        
                        await safeSet(expRef, {
                            id: expId,
                            organizationId: orgId,
                            date: pastDate.toISOString().split('T')[0],
                            category: isBigJob ? 'Materials' : 'Vehicle',
                            description: isBigJob ? 'Equipment Purchase - Supply House' : 'Fuel / Parts',
                            amount: parseFloat(expAmount.toFixed(2)),
                            vendor: 'Local Supply Co',
                            paidBy: 'Admin'
                        });
                    }
                }
            }

            const activeJobId = `demo-job-active-${orgId}`;
            await safeSet(db.collection('jobs').doc(activeJobId), {
                id: activeJobId,
                organizationId: orgId,
                customerId: customerIds[0],
                customerName: 'Alice Johnson',
                address: `100 Maple Ave, Austin, TX 78701`,
                tasks: ['No Cooling Diagnostic'],
                jobStatus: 'In Progress',
                appointmentTime: new Date().toISOString(),
                assignedTechnicianId: userIds[1],
                assignedTechnicianName: 'Mike Technic',
                invoice: {
                    id: 'INV-ACTIVE',
                    status: 'Unpaid',
                    amount: 89,
                    totalAmount: 89,
                    subtotal: 89,
                    taxAmount: 0,
                    items: [{ id: '1', description: 'Diagnostic Fee', quantity: 1, unitPrice: 89, total: 89, type: 'Labor' }]
                },
                jobEvents: [{ type: 'Arrived', timestamp: new Date().toISOString() }],
                createdAt: new Date().toISOString()
            });

            const futureJobId = `demo-job-future-${orgId}`;
            await safeSet(db.collection('jobs').doc(futureJobId), {
                id: futureJobId,
                organizationId: orgId,
                customerId: customerIds[1],
                customerName: 'Bob Smith',
                address: `101 Maple Ave, Austin, TX 78701`,
                tasks: ['System Installation Quote'],
                jobStatus: 'Scheduled',
                appointmentTime: new Date(now.getTime() + 86400000).toISOString(),
                assignedTechnicianId: userIds[2],
                assignedTechnicianName: 'Sarah Sales',
                invoice: { id: 'INV-FUTURE', status: 'Pending', amount: 0, totalAmount: 0, items: [], subtotal: 0, taxAmount: 0 },
                jobEvents: [],
                createdAt: new Date().toISOString()
            });

            for(let k=0; k<20; k++) {
                const saId = `sa-${orgId}-${k}`;
                const cust = customerIds[k % customerIds.length];
                await safeSet(db.collection('serviceAgreements').doc(saId), {
                    id: saId,
                    organizationId: orgId,
                    customerId: cust,
                    customerName: `${firstNames[k % firstNames.length]} ${lastNames[k % lastNames.length]}`,
                    planName: 'Gold Member',
                    price: 29,
                    billingCycle: 'Monthly',
                    startDate: new Date().toISOString(),
                    endDate: new Date(now.getTime() + 31536000000).toISOString(),
                    status: 'Active',
                    visitsTotal: 2,
                    visitsRemaining: 2
                });
            }

            const propStatuses = ['Accepted', 'Accepted', 'Sent', 'Sent', 'Draft'];
            const propAmounts = [15000, 8500, 12000, 5000, 4000];
            
            for(let p=0; p<5; p++) {
                const propId = `demo-prop-${orgId}-${p}`;
                await safeSet(db.collection('proposals').doc(propId), {
                    id: propId,
                    organizationId: orgId,
                    customerName: `${firstNames[p]} ${lastNames[p]}`,
                    technicianId: userIds[2],
                    createdAt: new Date(now.getTime() - (p * 86400000)).toISOString(),
                    status: propStatuses[p],
                    total: propAmounts[p],
                    subtotal: propAmounts[p],
                    taxAmount: 0,
                    items: [
                        { id: '1', name: 'System Replacement', description: 'HVAC System Upgrade', price: propAmounts[p], quantity: 1, total: propAmounts[p], tier: 'Best' }
                    ],
                    selectedOption: propStatuses[p] === 'Accepted' ? 'Best' : null
                });
            }

            const docs = [
                { title: 'Employee Handbook', type: 'Handbook', content: '<h3>Company Policy</h3><p>Standard operating procedures...</p>' },
                { title: 'Safety Policy 2025', type: 'Policy', content: '<h3>Safety First</h3><p>OSHA compliance requirements...</p>' },
                { title: 'Maintenance Checklist', type: 'Master Template', content: '<h3>Checklist</h3><ul><li>Check Filter</li><li>Check Freon</li></ul>' }
            ];
            for(let d=0; d<docs.length; d++) {
                const docId = `doc-${orgId}-${d}`;
                await safeSet(db.collection('documents').doc(docId), {
                    id: docId,
                    organizationId: orgId,
                    ...docs[d],
                    createdAt: now.toISOString(),
                    createdBy: userIds[0]
                });
            }

            await safeSet(db.collection('inspectionTemplates').doc(`tpl-${orgId}`), {
                id: `tpl-${orgId}`,
                organizationId: orgId,
                name: 'AC Tune Up',
                description: 'Standard 21-point inspection',
                items: [
                    { id: 'f1', label: 'Check Filter', type: 'PassFail', required: true },
                    { id: 'f2', label: 'Check Capacitors', type: 'PassFail', required: true },
                    { id: 'f3', label: 'Suction Pressure', type: 'Number', required: true }
                ]
            });

            const applicants = [
                { name: 'John Doe', pos: 'HVAC Tech', status: 'New' },
                { name: 'Jane Smith', pos: 'Office Admin', status: 'Interview' },
                { name: 'Bob Jones', pos: 'Installer', status: 'Hired' },
                { name: 'Alice Brown', pos: 'Helper', status: 'Screening' },
                { name: 'Tom Wilson', pos: 'Sales', status: 'Offer Sent' }
            ];
            for(let a=0; a<applicants.length; a++) {
                const app = applicants[a];
                const appId = `app-${orgId}-${a}`;
                await safeSet(db.collection('applicants').doc(appId), {
                    id: appId,
                    organizationId: orgId,
                    firstName: app.name.split(' ')[0],
                    lastName: app.name.split(' ')[1],
                    email: `app${a}@example.com`,
                    phone: '555-0199',
                    position: app.pos,
                    experienceYears: 5,
                    status: app.status,
                    appliedDate: new Date().toISOString()
                });
            }

            const reviews = [
                { name: 'Happy Customer', rating: 5, text: 'Great service! Mike was on time and fixed my AC quickly.' },
                { name: 'Concerned Citizen', rating: 3, text: 'Service was okay but price was higher than expected.' },
                { name: 'Loyal Client', rating: 5, text: 'I have been using Apex for years. Always reliable.' },
                { name: 'New Homeowner', rating: 4, text: 'Good inspection, helped me understand my system.' },
                { name: 'Tech Fan', rating: 5, text: 'The technician was very knowledgeable and polite.' }
            ];
            for(let r=0; r<reviews.length; r++) {
                const rev = reviews[r];
                const revId = `rev-${orgId}-${r}`;
                await safeSet(db.collection('reviews').doc(revId), {
                    id: revId,
                    organizationId: orgId,
                    platform: r % 2 === 0 ? 'Google' : 'Yelp',
                    customerName: rev.name,
                    rating: rev.rating,
                    content: rev.text,
                    date: new Date().toISOString().split('T')[0],
                    responded: r % 2 === 0
                });
            }

            await safeSet(db.collection('refrigerantCylinders').doc(`cyl-${orgId}`), {
                id: `cyl-${orgId}`,
                organizationId: orgId,
                tag: 'CYL-101',
                type: 'R410A',
                status: 'In Use',
                totalWeight: 25,
                remainingWeight: 18
            });
            await safeSet(db.collection('toolMaintenanceLogs').doc(`tool-${orgId}`), {
                id: `tool-${orgId}`,
                organizationId: orgId,
                date: new Date().toISOString(),
                toolType: 'Vacuum Pump',
                serialNumber: 'VP-999',
                action: 'Oil Change',
                result: 'Pass',
                nextDueDate: '2025-01-01',
                notes: 'Routine maintenance'
            });
            await safeSet(db.collection('incidents').doc(`inc-${orgId}`), {
                id: `inc-${orgId}`,
                organizationId: orgId,
                reporterId: userIds[1],
                reporterName: 'Mike Technic',
                date: new Date().toISOString(),
                type: 'Vehicle',
                description: 'Minor scratch on bumper in parking lot.',
                status: 'Open'
            });

            await commitAndReset();
            alert("High-Revenue Demo Suite Created! 'Apex Service Solutions (Demo)' is ready for presentation.");
        } catch (e: any) {
            console.error(e);
            alert("Error seeding demo suite: " + e.message);
        } finally {
            setSeeding(false);
        }
    };

    if (hidePromoMaker) {
        return (
            <div className="flex gap-2">
                <Button 
                    onClick={handleSeedData} 
                    disabled={seeding} 
                    className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2 shadow-lg"
                >
                    <Database size={18} />
                    {seeding ? 'Creating Data...' : 'Seed Test Data'}
                </Button>
                <Button 
                    onClick={handleSeedDemoSuite} 
                    disabled={seeding} 
                    className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 shadow-lg"
                >
                    <Sparkles size={18} />
                    {seeding ? 'Building Demo...' : 'Create Full Demo Suite'}
                </Button>
            </div>
        );
    }

    return (
        <Card className="p-6 bg-slate-900 border-slate-800">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                    <Tag className="text-blue-500" />
                    <h3 className="text-lg font-bold text-white">Active Promo Codes</h3>
                </div>
            </div>

            <form onSubmit={handleAddPromo} className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-8 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                <Input 
                    placeholder="CODE" 
                    value={newCode} 
                    onChange={e => setNewCode(e.target.value)} 
                    className="uppercase bg-slate-900 border-slate-700" 
                    required 
                />
                <Input 
                    placeholder="Description" 
                    value={newDesc} 
                    onChange={e => setNewDesc(e.target.value)} 
                    className="bg-slate-900 border-slate-700" 
                />
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-3">
                    <Calendar size={16} className="text-slate-500" />
                    <input 
                        type="number" 
                        placeholder="Months" 
                        value={durationMonths} 
                        onChange={e => setDurationMonths(e.target.value)}
                        className="w-full bg-transparent border-none text-white text-sm focus:ring-0"
                    />
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Mo</span>
                </div>
                <Button type="submit" disabled={seeding} className="bg-blue-600 hover:bg-blue-500">
                    <Plus size={18} />
                    Add
                </Button>
            </form>

            {loadingPromos ? (
                <div className="flex justify-center p-4 md:p-8"><Loader2 className="animate-spin text-blue-500" /></div>
            ) : (
                <div className="overflow-hidden rounded-xl border border-slate-800">
                    <Table headers={['Code', 'Description', 'Duration', 'Status', 'Actions']}>
                        {promoCodes.map(promo => (
                            <tr key={promo.id} className="border-b border-slate-800 last:border-0">
                                <td className="px-4 py-4 font-mono font-bold text-blue-400">{promo.code}</td>
                                <td className="px-4 py-4 text-sm text-slate-400">{promo.description}</td>
                                <td className="px-4 py-4 text-sm text-white font-bold">{promo.durationMonths || 12} Months</td>
                                <td className="px-4 py-4">
                                    <button 
                                        onClick={() => handleTogglePromo(promo.id, promo.isActive)} 
                                        className={`flex items-center gap-1 text-[10px] uppercase tracking-wider font-black px-2 py-1 rounded-md transition-all ${promo.isActive ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}
                                    >
                                        {promo.isActive ? <Check size={10} /> : <X size={10} />}
                                        {promo.isActive ? 'Active' : 'Inactive'}
                                    </button>
                                </td>
                                <td className="px-4 py-4">
                                    <button 
                                        onClick={() => handleDeletePromo(promo.id)} 
                                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {promoCodes.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-4 md:py-8 text-center text-slate-500 text-sm">
                                    No active promo codes found.
                                </td>
                            </tr>
                        )}
                    </Table>
                </div>
            )}
        </Card>
    );
};

export default DataSeedingActions;
