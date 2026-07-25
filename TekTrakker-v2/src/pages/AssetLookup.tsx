import React, { useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAppContext } from 'context/AppContext';
import { useLanguage } from 'context/LanguageContext';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import { Wrench, CalendarIcon, FileText, ArrowLeft, MapPin, Tag, Compass, Layers, Camera } from 'lucide-react';

const AssetLookup: React.FC = () => {
    const { customerId } = useParams<{ customerId: string }>();
    const [searchParams] = useSearchParams();
    const assetId = searchParams.get('assetId');
    const { state } = useAppContext();
    const navigate = useNavigate();
    const { t } = useLanguage();

    const customer = useMemo(() => 
        state.customers.find(c => c.id === customerId), 
    [state.customers, customerId]);

    const asset = useMemo(() => 
        customer?.equipment?.find(e => e.id === assetId), 
    [customer, assetId]);

    // Lookup matching Service Location Name
    const propertyName = useMemo(() => {
        if (!asset || !customer?.serviceLocations) return '';
        const propId = asset.propertyId || asset.locationId;
        const matchingLoc = customer.serviceLocations.find(loc => loc.id === propId);
        return matchingLoc ? matchingLoc.propertyName || matchingLoc.name : '';
    }, [asset, customer]);

    // Load other refrigeration split-system components in the same group
    const linkedSystemComponents = useMemo(() => {
        if (!asset?.systemGroupId || !customer?.equipment) return [];
        return customer.equipment.filter(e => e.systemGroupId === asset.systemGroupId);
    }, [asset, customer]);

    const history = useMemo(() => {
        if (!customer) return [];
        return state.jobs
            .filter(j => j.customerId === customer.id)
            .sort((a,b) => new Date(b.appointmentTime).getTime() - new Date(a.appointmentTime).getTime());
    }, [state.jobs, customer]);

    if (!customer) {
        return (
            <div className="p-4 md:p-8 text-center max-w-md mx-auto">
                <Card className="border-t-4 border-red-500 p-6 space-y-4">
                    <h2 className="text-xl font-bold text-red-600">{t("Asset Not Found")}</h2>
                    <p className="text-slate-500 text-sm">{t("The scanned code does not match a known customer record.")}</p>
                    <Button onClick={() => navigate('/')} className="mt-2 w-full">{t("Go Home")}</Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-4 max-w-2xl mx-auto space-y-5">
            <header className="flex items-center gap-4">
                <button 
                    onClick={() => navigate(-1)} 
                    className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors" 
                    title={t("Go Back")} 
                    aria-label={t("Go Back")}
                >
                    <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("Asset Service Center")}</h1>
                    <p className="text-sm text-slate-500 font-medium">{customer.name}</p>
                </div>
            </header>

            {/* Premium Location Hierarchy Trail */}
            {asset && (
                <div className="bg-slate-100/80 dark:bg-slate-800/80 p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2 flex-wrap text-[11px] md:text-xs text-slate-600 dark:text-slate-300 font-semibold shadow-sm">
                    <MapPin size={14} className="text-emerald-500 shrink-0" />
                    <span>{customer.name}</span>
                    <span className="text-slate-400">&gt;</span>
                    <span>{propertyName || t("Main Site")}</span>
                    {(asset.physicalLocation || asset.exactPlacement) ? (
                        <>
                            <span className="text-slate-400">&gt;</span>
                            <span className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-900 dark:text-white font-bold">{asset.physicalLocation || t("Area")}</span>
                            {asset.exactPlacement && (
                                <>
                                    <span className="text-slate-400">&gt;</span>
                                    <span className="text-slate-500 dark:text-slate-400 italic">{asset.exactPlacement}</span>
                                </>
                            )}
                        </>
                    ) : asset.location ? (
                        <>
                            <span className="text-slate-400">&gt;</span>
                            <span>{asset.location}</span>
                        </>
                    ) : null}
                    {asset.servesArea && (
                        <span className="ml-auto text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/50">
                            {t("Serves")}: {asset.servesArea}
                        </span>
                    )}
                </div>
            )}

            {/* Active Asset Info Card */}
            {asset ? (
                <Card className="border-t-4 border-blue-500 p-5 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h2 className="text-xl font-bold text-slate-950 dark:text-white">{asset.brand} {asset.type}</h2>
                                {asset.condition && (
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                        asset.condition === 'Excellent' || asset.condition === 'Good' 
                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' 
                                            : asset.condition === 'Fair' 
                                                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' 
                                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                    }`}>
                                        {t(asset.condition)}
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-300 font-mono">Model: {asset.model} • SN: {asset.serial}</p>
                        </div>
                        {asset.assetTag && (
                            <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs px-2.5 py-1 rounded-full font-mono font-bold flex items-center gap-1 w-fit">
                                <Tag size={12} /> {asset.assetTag}
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs pt-3 border-t border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                        {asset.installDate && (
                            <div>
                                <span className="font-semibold block mb-0.5 text-slate-400 uppercase tracking-wide text-[10px]">{t("Installed Date")}</span>
                                <span className="text-slate-800 dark:text-slate-200 font-medium">{new Date(asset.installDate).toLocaleDateString()}</span>
                            </div>
                        )}
                        {asset.notes && (
                            <div className="col-span-2">
                                <span className="font-semibold block mb-0.5 text-slate-400 uppercase tracking-wide text-[10px]">{t("Notes")}</span>
                                <span className="text-slate-850 dark:text-slate-200">{asset.notes}</span>
                            </div>
                        )}
                        {asset.gpsPin && (
                            <div className="col-span-2 flex items-center gap-1 font-mono text-[10px]">
                                <Compass size={12} className="text-slate-400" />
                                <span>GPS Coordinates: {asset.gpsPin.lat.toFixed(6)}, {asset.gpsPin.lng.toFixed(6)}</span>
                            </div>
                        )}
                    </div>
                </Card>
            ) : (
                <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 p-4">
                    <p className="text-yellow-800 dark:text-yellow-200 font-medium">{t("Specific asset ID not found.")}</p>
                    <p className="text-xs text-yellow-600 dark:text-yellow-400">{t("Showing general customer history.")}</p>
                </Card>
            )}

            {/* Refrigeration / Linked Split System Visualization Dashboard */}
            {asset && asset.systemGroupId && linkedSystemComponents.length > 1 && (
                <Card className="border-l-4 border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/10 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <Layers className="text-indigo-600 dark:text-indigo-400 shrink-0" size={18} />
                        <div>
                            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                                {t("Split Refrigeration System Map")}
                            </h3>
                            <p className="text-sm font-bold text-indigo-900 dark:text-indigo-200">{asset.systemGroupName}</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {linkedSystemComponents.map(comp => {
                            const isActive = comp.id === asset.id;
                            return (
                                <button
                                    key={comp.id}
                                    onClick={() => navigate(`?assetId=${comp.id}`)}
                                    className={`p-3 rounded-xl border text-left transition-all relative ${
                                        isActive 
                                            ? 'bg-indigo-600 border-indigo-700 text-white shadow-md scale-[1.02]' 
                                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 hover:scale-[1.01]'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`text-[9px] uppercase font-bold tracking-wide px-1.5 py-0.5 rounded ${
                                            isActive 
                                                ? 'bg-indigo-800/80 text-white' 
                                                : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                                        }`}>
                                            {t(comp.systemGroupRole || 'Member')}
                                        </span>
                                        {comp.condition && (
                                            <span className={`text-[9px] font-bold ${
                                                isActive ? 'text-indigo-100' : 'text-slate-400'
                                            }`}>
                                                {comp.condition}
                                            </span>
                                        )}
                                    </div>
                                    <h4 className="font-bold text-xs truncate">{comp.name || `${comp.brand} ${comp.model}`}</h4>
                                    <p className={`text-[10px] mt-1 font-mono truncate ${
                                        isActive ? 'text-indigo-200' : 'text-slate-500'
                                    }`}>
                                        SN: {comp.serial || 'N/A'}
                                    </p>
                                    <p className={`text-[10px] mt-0.5 truncate flex items-center gap-0.5 ${
                                        isActive ? 'text-indigo-200' : 'text-slate-500'
                                    }`}>
                                        <MapPin size={8} /> {comp.physicalLocation || comp.location || 'N/A'}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                </Card>
            )}

            {/* Rich Media / Technician Verification Photos Grid */}
            {asset && (asset.wideLocationPhotoUrl || asset.accessPointPhotoUrl || asset.qrCodePhotoUrl || asset.serialPhotoUrl || asset.unitTagPhotoUrl || asset.conditionPhotoUrl) && (
                <Card className="p-4">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Camera size={16} className="text-emerald-500" />
                        {t("Field Verification Evidence")}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {asset.wideLocationPhotoUrl && (
                            <div className="space-y-1 flex flex-col">
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate block">{t("Location Context")}</span>
                                <div className="aspect-square rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-900 relative group cursor-pointer flex-1" onClick={() => window.open(asset.wideLocationPhotoUrl, '_blank')}>
                                    <img src={asset.wideLocationPhotoUrl} alt="Location Context" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                </div>
                                {asset.wideLocationPhotoLabel && (
                                    <p className="text-[11px] text-slate-700 dark:text-slate-350 font-semibold italic text-center px-1 break-words mt-1 leading-normal">
                                        "{asset.wideLocationPhotoLabel}"
                                    </p>
                                )}
                            </div>
                        )}
                        {asset.accessPointPhotoUrl && (
                            <div className="space-y-1 flex flex-col">
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate block">{t("Access Pathway")}</span>
                                <div className="aspect-square rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-900 relative group cursor-pointer flex-1" onClick={() => window.open(asset.accessPointPhotoUrl, '_blank')}>
                                    <img src={asset.accessPointPhotoUrl} alt="Access Pathway" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                </div>
                                {asset.accessPointPhotoLabel && (
                                    <p className="text-[11px] text-slate-700 dark:text-slate-355 font-semibold italic text-center px-1 break-words mt-1 leading-normal">
                                        "{asset.accessPointPhotoLabel}"
                                    </p>
                                )}
                            </div>
                        )}
                        {asset.qrCodePhotoUrl && (
                            <div className="space-y-1 flex flex-col">
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate block">{t("QR Tag Close-up")}</span>
                                <div className="aspect-square rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-900 relative group cursor-pointer flex-1" onClick={() => window.open(asset.qrCodePhotoUrl, '_blank')}>
                                    <img src={asset.qrCodePhotoUrl} alt="QR Code" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                </div>
                                {asset.qrCodePhotoLabel && (
                                    <p className="text-[11px] text-slate-700 dark:text-slate-355 font-semibold italic text-center px-1 break-words mt-1 leading-normal">
                                        "{asset.qrCodePhotoLabel}"
                                    </p>
                                )}
                            </div>
                        )}
                        {asset.serialPhotoUrl && (
                            <div className="space-y-1 flex flex-col">
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate block">{t("Serial Tag Photo")}</span>
                                <div className="aspect-square rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-900 relative group cursor-pointer flex-1" onClick={() => window.open(asset.serialPhotoUrl, '_blank')}>
                                    <img src={asset.serialPhotoUrl} alt="Serial Tag" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                </div>
                                {asset.serialPhotoLabel && (
                                    <p className="text-[11px] text-slate-700 dark:text-slate-355 font-semibold italic text-center px-1 break-words mt-1 leading-normal">
                                        "{asset.serialPhotoLabel}"
                                    </p>
                                )}
                            </div>
                        )}
                        {asset.unitTagPhotoUrl && (
                            <div className="space-y-1 flex flex-col">
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate block">{t("Data Plate Plate")}</span>
                                <div className="aspect-square rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-900 relative group cursor-pointer flex-1" onClick={() => window.open(asset.unitTagPhotoUrl, '_blank')}>
                                    <img src={asset.unitTagPhotoUrl} alt="Data Plate" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                </div>
                                {asset.unitTagPhotoLabel && (
                                    <p className="text-[11px] text-slate-700 dark:text-slate-355 font-semibold italic text-center px-1 break-words mt-1 leading-normal">
                                        "{asset.unitTagPhotoLabel}"
                                    </p>
                                )}
                            </div>
                        )}
                        {asset.conditionPhotoUrl && (
                            <div className="space-y-1 flex flex-col">
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate block">{t("Condition Photo")}</span>
                                <div className="aspect-square rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-900 relative group cursor-pointer flex-1" onClick={() => window.open(asset.conditionPhotoUrl, '_blank')}>
                                    <img src={asset.conditionPhotoUrl} alt="Condition Photo" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                </div>
                                {asset.conditionPhotoLabel && (
                                    <p className="text-[11px] text-slate-700 dark:text-slate-355 font-semibold italic text-center px-1 break-words mt-1 leading-normal">
                                        "{asset.conditionPhotoLabel}"
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </Card>
            )}

            {/* Service History Panel */}
            <div className="space-y-3">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <CalendarIcon size={18} className="text-blue-500" /> {t("Service History")}
                </h3>
                <div className="space-y-3">
                    {history.length > 0 ? history.map(job => (
                        <div key={job.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                            <div className="flex justify-between items-start mb-2">
                                <span className="font-bold text-slate-900 dark:text-white">{new Date(job.appointmentTime).toLocaleDateString()}</span>
                                <span className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${job.jobStatus === 'Completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                                    {t(job.jobStatus)}
                                </span>
                            </div>
                            <div className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                                <span className="font-semibold text-slate-800 dark:text-slate-200">{t("Tasks:")}</span> {job.tasks.join(', ')}
                            </div>
                            {job.notes?.employeeFeedback && (
                                <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                                    <FileText size={12} className="inline mr-1 text-slate-400"/>
                                    {job.notes.employeeFeedback}
                                </div>
                            )}
                        </div>
                    )) : (
                        <p className="text-slate-500 text-sm italic">{t("No service history recorded.")}</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AssetLookup;
