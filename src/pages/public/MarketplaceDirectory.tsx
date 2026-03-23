
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../lib/firebase';
import type { Organization, IndustryVertical } from '../../types';
import { Link } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { Building, MapPin, Search, Award } from 'lucide-react';

const ALL_INDUSTRIES: IndustryVertical[] = [
    'HVAC', 'Plumbing', 'Electrical', 'Landscaping', 'General', 
    'Cleaning', 'Painting', 'Roofing', 'Contracting', 'Masonry',
    'Telecommunications', 'Solar', 'Security', 'Pet Grooming'
];

const SkeletonCard: React.FC = () => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
        <div className="p-6 animate-pulse">
            <div className="flex items-start gap-4">
                <div className="h-20 w-20 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                <div className="flex-1">
                    <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                </div>
            </div>
            <div className="mt-4 space-y-2">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-5/6"></div>
            </div>
             <div className="mt-4 h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
        </div>
    </div>
);

type SortOption = 'default' | 'verified' | 'name';

const MarketplaceDirectory: React.FC = () => {
    const [orgs, setOrgs] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIndustry, setSelectedIndustry] = useState<IndustryVertical | 'all'>('all');
    const [sortBy, setSortBy] = useState<SortOption>('default');

    useEffect(() => {
        const fetchOrgs = async () => {
            setLoading(true);
            try {
                const snapshot = await db.collection('organizations')
                    .where('publicProfileEnabled', '==', true)
                    .get();
                const orgsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Organization));
                setOrgs(orgsData);
            } catch (error) {
                console.error("ERROR FETCHING ORGANIZATIONS:", error);
            }
            setLoading(false);
        };
        fetchOrgs();
    }, []);

    const filteredAndSortedOrgs = useMemo(() => {
        const filtered = orgs.filter(org => {
            const matchesIndustry = selectedIndustry === 'all' || org.industry === selectedIndustry;
            const matchesSearch = searchTerm === '' || 
                org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                org.address?.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
                org.address?.state.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesIndustry && matchesSearch;
        });

        switch (sortBy) {
            case 'verified':
                return [...filtered].sort((a, b) => (b.isVerified ? 1 : 0) - (a.isVerified ? 1 : 0));
            case 'name':
                return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
            case 'default':
            default:
                return filtered;
        }
    }, [orgs, searchTerm, selectedIndustry, sortBy]);

    return (
        <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
            <div className="container mx-auto px-4 py-4 md:py-8">
                <header className="bg-primary-600 dark:bg-primary-700 rounded-xl shadow-lg p-4 md:p-8 md:p-12 mb-12 text-center text-white relative overflow-hidden">
                    <div className="relative z-10">
                        <img src="/tektrakker-logo-full.png" alt="TekTrakker Logo" className="h-16 mx-auto mb-4" />
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight">Contractor Marketplace</h1>
                        <p className="mt-4 text-lg text-primary-100 max-w-2xl mx-auto">Find trusted, high-quality local service professionals for any job.</p>
                    </div>
                    <div className="absolute inset-0 bg-black opacity-20"></div>
                </header>

                <Card className="p-4 mb-8 sticky top-4 z-20 shadow-lg">
                     <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                        <Input 
                            placeholder="Search by name or location..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            icon={<Search size={18} className="text-gray-400"/>}
                            className="md:col-span-2"
                        />
                         <Select
                            value={selectedIndustry}
                            onChange={e => setSelectedIndustry(e.target.value as any)}
                        >
                            <option value="all">All Industries</option>
                            {ALL_INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                        </Select>
                        <Select
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value as SortOption)}
                        >
                            <option value="default">Sort by: Default</option>
                            <option value="verified">Sort by: Verified First</option>
                            <option value="name">Sort by: Name (A-Z)</option>
                        </Select>
                    </div>
                </Card>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
                    </div>
                ) : filteredAndSortedOrgs.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {filteredAndSortedOrgs.map(org => (
                            <Link key={org.id} to={`/marketplace/${org.id}`} className="block transform hover:-translate-y-1 transition-all duration-300">
                                <Card className="h-full flex flex-col hover:shadow-xl">
                                    <div className="p-6">
                                        <div className="flex items-start gap-4">
                                            <div className="h-20 w-20 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center overflow-hidden border border-gray-200 dark:border-gray-700">
                                                {org.logoUrl ? <img src={org.logoUrl} alt={`${org.name} Logo`} className="w-full h-full object-contain p-1"/> : <Building className="text-gray-400"/>}
                                            </div>
                                            <div className="flex-1">
                                                <h2 className="text-xl font-bold text-gray-800 dark:text-white">{org.name}</h2>
                                                <p className="text-sm font-medium text-primary-600 dark:text-primary-400">{org.industry}</p>
                                            </div>
                                        </div>
                                        <p className="mt-4 text-sm text-gray-600 dark:text-gray-300 flex-grow clamp-3">{org.publicDescription || 'No description available.'}</p>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 px-6 py-4 mt-auto flex justify-between items-center">
                                        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 gap-4">
                                             {org.address && (
                                            <div className="flex items-center gap-1.5">
                                                <MapPin size={14} />
                                                <span>{org.address.city}, {org.address.state}</span>
                                            </div>
                                            )}
                                        </div>
                                        {org.isVerified && (
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-green-600">
                                            <Award size={14} />
                                            <span>Verified</span>
                                        </div>
                                        )}
                                    </div>
                                </Card>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16">
                        <div className="inline-block p-5 bg-primary-100 dark:bg-primary-900 rounded-full">
                             <Search size={48} className="text-primary-600 dark:text-primary-400"/>
                        </div>
                        <h3 className="mt-6 text-xl font-bold text-gray-800 dark:text-white">No Contractors Found</h3>
                        <p className="mt-2 text-gray-500">Your search for "{searchTerm}" in {selectedIndustry} returned no results. Try a different search.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MarketplaceDirectory;
