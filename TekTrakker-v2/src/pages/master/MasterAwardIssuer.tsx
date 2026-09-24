import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Award as AwardIcon,
  PlusCircle,
  Building2,
  CheckCircle2,
  Trash2,
  Edit,
  Eye,
  FileText,
  Sparkles,
  ShieldCheck,
  Search,
  ExternalLink,
  RefreshCw,
  Sliders,
  Check,
  Copy
} from 'lucide-react';
import { globalConfirm } from 'lib/globalConfirm';
import {
  AWARD_CATEGORIES,
  getStoredAwards,
  saveStoredAwards,
  type TekTrakkerAward,
  type RatingMetric,
  type BadgeTheme
} from '../../data/awardBadgesData';
import { TekTrakkerAwardBadge } from '../../components/features/awards/TekTrakkerAwardBadge';
import { openPrintableCertificate } from '../../utils/CertificateGenerator';
import { useAppContext } from '../../context/AppContext';

export default function MasterAwardIssuer() {
  const { state } = useAppContext();
  const [awards, setAwards] = useState<TekTrakkerAward[]>([]);
  const [activeTab, setActiveTab] = useState<'issue' | 'ledger'>('issue');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAward, setSelectedAward] = useState<TekTrakkerAward | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Form State for Issuing Awards
  const [targetOrgId, setTargetOrgId] = useState('org_apex_hvac');
  const [targetOrgName, setTargetOrgName] = useState('Apex HVAC & Climate Solutions');
  const [isCustomOrg, setIsCustomOrg] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState('hvac_excellence');
  const [awardYear, setAwardYear] = useState<number>(2026);
  const [overallScore, setOverallScore] = useState<number>(98.5);
  const [percentile, setPercentile] = useState('Top 1% Nationwide');
  const [starRating, setStarRating] = useState<number>(4.95);
  const [reviewCount, setReviewCount] = useState<number>(500);
  const [description, setDescription] = useState(
    'Official rating recognition issued by TekTrakker for outstanding field technology execution, safety compliance, and technician performance.'
  );

  // Default Metrics for the form
  const [metric1Name, setMetric1Name] = useState('First-Time Fix Rate');
  const [metric1Score, setMetric1Score] = useState<number>(99.0);
  const [metric2Name, setMetric2Name] = useState('Safety & EPA Compliance');
  const [metric2Score, setMetric2Score] = useState<number>(100.0);
  const [metric3Name, setMetric3Name] = useState('Customer Satisfaction Index');
  const [metric3Score, setMetric3Score] = useState<number>(98.2);

  // Load stored awards on mount
  useEffect(() => {
    const loaded = getStoredAwards();
    setAwards(loaded);
    if (loaded.length > 0) {
      setSelectedAward(loaded[0]);
    }
  }, []);

  // Update org name when selection changes from known organizations
  const handleOrgSelect = (orgId: string) => {
    if (orgId === 'custom') {
      setIsCustomOrg(true);
      setTargetOrgId(`org_${Date.now()}`);
      setTargetOrgName('');
      return;
    }
    setIsCustomOrg(false);
    setTargetOrgId(orgId);
    const orgObj = state.allOrganizations?.find((o) => o.id === orgId);
    if (orgObj) {
      setTargetOrgName(orgObj.name);
    }
  };

  const handleCreateAward = (e: React.FormEvent) => {
    e.preventDefault();
    const catDef = AWARD_CATEGORIES.find((c) => c.id === selectedCategoryId);
    if (!catDef) return;

    const metrics: RatingMetric[] = [
      { name: metric1Name, score: Number(metric1Score), weight: 0.35, benchmark: '98%+ industry benchmark' },
      { name: metric2Name, score: Number(metric2Score), weight: 0.35, benchmark: '100% verified compliance' },
      { name: metric3Name, score: Number(metric3Score), weight: 0.3, benchmark: `${starRating} stars avg rating` }
    ];

    const newAwardId = `award-${selectedCategoryId.substring(0, 4)}-${awardYear}-${Math.floor(100 + Math.random() * 900)}`;
    const newAward: TekTrakkerAward = {
      id: newAwardId,
      orgId: targetOrgId || 'org_apex_hvac',
      orgName: targetOrgName || 'Selected Organization',
      category: `${catDef.title} ${awardYear}`,
      categoryId: selectedCategoryId,
      year: Number(awardYear),
      overallScore: Number(overallScore),
      percentile: percentile || 'Top 2% Rated Service',
      starRating: Number(starRating),
      reviewCount: Number(reviewCount),
      issuedDate: new Date().toISOString().split('T')[0],
      claimed: false,
      badgeTheme: catDef.defaultTheme,
      verificationCode: `TT-AWD-${awardYear}-${Math.floor(1000 + Math.random() * 9000)}`,
      description: description,
      metrics: metrics
    };

    const updated = [newAward, ...awards];
    setAwards(updated);
    saveStoredAwards(updated);
    setSelectedAward(newAward);
    setActiveTab('ledger');
  };

  const handleDeleteAward = async (id: string) => {
    if (!(await globalConfirm('Are you sure you want to revoke/delete this award from the platform ledger?', 'Revoke Award', 'Revoke Award', 'Cancel'))) return;
    const updated = awards.filter((a) => a.id !== id);
    setAwards(updated);
    saveStoredAwards(updated);
    if (selectedAward?.id === id) {
      setSelectedAward(updated[0] || null);
    }
  };

  const handleCopyLink = (verificationCode: string) => {
    const url = `${window.location.origin}/#/awards/verify/${selectedAward?.id || ''}`;
    navigator.clipboard.writeText(url);
    setCopiedCode(verificationCode);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const filteredAwards = awards.filter(
    (a) =>
      a.orgName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.verificationCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 border border-amber-500/40 rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-12 -bottom-12 opacity-10 pointer-events-none">
          <Trophy className="w-96 h-96 text-amber-400" />
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider mb-3">
              <ShieldCheck className="w-4 h-4" />
              Platform Master Admin Authority
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              TekTrakker Business Recognition Issuer
            </h1>
            <p className="text-slate-400 text-sm md:text-base mt-2 max-w-2xl">
              As Platform Master Admin, you hold exclusive authority to rate field service organizations and issue official TekTrakker Awards based on telemetry, customer ratings, and compliance audits.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-900/90 backdrop-blur border border-slate-800 p-4 rounded-xl">
            <div className="text-center">
              <div className="text-2xl font-extrabold text-amber-400">{awards.length}</div>
              <div className="text-[11px] text-slate-400 font-semibold uppercase">Total Awards Issued</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-extrabold text-emerald-400">
                {awards.filter((a) => a.claimed).length}
              </div>
              <div className="text-[11px] text-slate-400 font-semibold uppercase font-mono">Claimed by Orgs</div>
            </div>
            <div className="text-center col-span-2 sm:col-span-1">
              <div className="text-2xl font-extrabold text-sky-400">
                {state.allOrganizations?.length || 1}
              </div>
              <div className="text-[11px] text-slate-400 font-semibold uppercase">Registered Orgs</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-3 mt-8 border-t border-slate-800 pt-4">
          <button
            onClick={() => setActiveTab('issue')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'issue'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            Issue New Organization Award
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'ledger'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Trophy className="w-4 h-4" />
            Platform Awards Ledger ({awards.length})
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* TAB 1: ISSUE NEW AWARD */}
        {activeTab === 'issue' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Form Column */}
            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <AwardIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Award Specification Form</h3>
                  <p className="text-xs text-slate-400">
                    Specify organization details and performance benchmarks to generate an official recognition.
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateAward} className="space-y-5">
                {/* Organization Selection */}
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                    Target Organization
                  </label>
                  <select
                    value={isCustomOrg ? 'custom' : targetOrgId}
                    onChange={(e) => handleOrgSelect(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-sm text-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value="org_apex_hvac">Apex HVAC & Climate Solutions (Demo Default)</option>
                    {state.allOrganizations && state.allOrganizations.length > 0 ? (
                      state.allOrganizations.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name} (ID: {org.id})
                        </option>
                      ))
                    ) : (
                      <option value="org_custom_1">Titan Electrical Contractors</option>
                    )}
                    <option value="custom">+ Enter Custom Organization Name...</option>
                  </select>

                  {isCustomOrg && (
                    <input
                      type="text"
                      placeholder="Type custom Organization Name"
                      value={targetOrgName}
                      onChange={(e) => setTargetOrgName(e.target.value)}
                      className="mt-2 w-full bg-slate-950 border border-amber-500/50 rounded-xl py-2 px-3 text-sm text-white focus:outline-none"
                      required
                    />
                  )}
                </div>

                {/* Category & Year */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                      Award Category
                    </label>
                    <select
                      value={selectedCategoryId}
                      onChange={(e) => setSelectedCategoryId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-sm text-white focus:border-amber-500 focus:outline-none"
                    >
                      {AWARD_CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                      Award Year
                    </label>
                    <input
                      type="number"
                      value={awardYear}
                      onChange={(e) => setAwardYear(parseInt(e.target.value) || 2026)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-sm text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Overall Score & Rating */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-4">
                  <div>
                    <div className="flex justify-between items-center text-xs font-bold text-slate-400 mb-1">
                      <span>OVERALL EXCELLENCE SCORE (0 - 100)</span>
                      <span className="text-amber-400 text-sm font-extrabold">{overallScore} / 100</span>
                    </div>
                    <input
                      type="range"
                      min="85"
                      max="100"
                      step="0.1"
                      value={overallScore}
                      onChange={(e) => setOverallScore(parseFloat(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-400 mb-1">Percentile Badge</label>
                      <input
                        type="text"
                        value={percentile}
                        onChange={(e) => setPercentile(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-400 mb-1">Star Rating (out of 5)</label>
                      <input
                        type="number"
                        step="0.01"
                        max="5"
                        min="4"
                        value={starRating}
                        onChange={(e) => setStarRating(parseFloat(e.target.value) || 4.9)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-400 mb-1">Verified Review Count</label>
                      <input
                        type="number"
                        value={reviewCount}
                        onChange={(e) => setReviewCount(parseInt(e.target.value) || 100)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Scorecard Metrics Customization */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold uppercase text-slate-400 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-amber-400" />
                    Scorecard Metric Benchmarks
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-2">
                      <input
                        type="text"
                        value={metric1Name}
                        onChange={(e) => setMetric1Name(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-white font-semibold"
                      />
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Score: {metric1Score}%</span>
                        <input
                          type="range"
                          min="80"
                          max="100"
                          value={metric1Score}
                          onChange={(e) => setMetric1Score(parseFloat(e.target.value))}
                          className="w-24 accent-amber-500"
                        />
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-2">
                      <input
                        type="text"
                        value={metric2Name}
                        onChange={(e) => setMetric2Name(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-white font-semibold"
                      />
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Score: {metric2Score}%</span>
                        <input
                          type="range"
                          min="80"
                          max="100"
                          value={metric2Score}
                          onChange={(e) => setMetric2Score(parseFloat(e.target.value))}
                          className="w-24 accent-amber-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                    Official Award Citation / Description
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                >
                  <Trophy className="w-5 h-5" />
                  Issue Official Award to Organization
                </button>
              </form>
            </div>

            {/* Preview Column */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Live Badge Render Preview
                  </h4>
                  <span className="text-xs text-slate-400 font-mono">Real-Time Vector</span>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 flex items-center justify-center min-h-[300px]">
                  {selectedAward ? (
                    <TekTrakkerAwardBadge
                      award={{
                        ...selectedAward,
                        orgName: targetOrgName || selectedAward.orgName,
                        overallScore: Number(overallScore)
                      }}
                      theme={selectedAward.badgeTheme}
                      size="md"
                    />
                  ) : (
                    <div className="text-center text-slate-500 text-xs">
                      No award selected for preview.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PLATFORM AWARDS LEDGER */}
        {activeTab === 'ledger' && (
          <div className="space-y-6">
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search orgs, categories, codes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="text-xs text-slate-400 font-semibold">
                Showing <span className="text-amber-400 font-bold">{filteredAwards.length}</span> of {awards.length} platform awards
              </div>
            </div>

            {/* Awards Grid / Ledger */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAwards.map((award) => (
                <div
                  key={award.id}
                  className={`bg-slate-900 border rounded-2xl p-6 flex flex-col justify-between transition-all ${
                    selectedAward?.id === award.id
                      ? 'border-amber-500/80 ring-2 ring-amber-500/20'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    {/* Header Badges */}
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          award.claimed
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {award.claimed ? <CheckCircle2 className="w-3 h-3" /> : <AwardIcon className="w-3 h-3" />}
                        {award.claimed ? 'Claimed by Org' : 'Pending Claim'}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">{award.verificationCode}</span>
                    </div>

                    <div className="flex justify-center my-3" id={`badge-svg-${award.id}`}>
                      <TekTrakkerAwardBadge award={award} theme={award.badgeTheme} size="sm" />
                    </div>

                    <div className="space-y-1 text-center">
                      <h4 className="text-sm font-bold text-white truncate">{award.orgName}</h4>
                      <p className="text-xs text-amber-400 font-semibold truncate">{award.category}</p>
                      <p className="text-[11px] text-slate-400">Score: <strong className="text-white">{award.overallScore} / 100</strong> • Issued: {award.issuedDate}</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <button
                      onClick={() => openPrintableCertificate(award)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-emerald-400 rounded-lg flex items-center gap-1 transition-all"
                      title="Print Official Certificate"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Certificate
                    </button>

                    <button
                      onClick={() => handleCopyLink(award.verificationCode)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-sky-400 rounded-lg flex items-center gap-1 transition-all"
                      title="Copy Public Verification Link"
                    >
                      {copiedCode === award.verificationCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      Verify Link
                    </button>

                    <button
                      onClick={() => handleDeleteAward(award.id)}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                      title="Revoke / Delete Award"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
