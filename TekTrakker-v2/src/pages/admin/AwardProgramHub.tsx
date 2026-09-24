import React, { useState, useEffect } from 'react';
import {
  Trophy,
  CheckCircle2,
  Code,
  Download,
  Copy,
  Check,
  Star,
  ExternalLink,
  Award as AwardIcon,
  ShieldCheck,
  Sparkles,
  Layers,
  FileText,
  Building2,
  Info
} from 'lucide-react';
import {
  AWARD_CATEGORIES,
  getStoredAwards,
  saveStoredAwards,
  generateScriptEmbedCode,
  generateIframeEmbedCode,
  generateReactEmbedCode,
  generateJsonLdSchema,
  generateMultiAwardScriptCode,
  generateMultiAwardIframeCode,
  generateMultiAwardReactCode,
  type TekTrakkerAward,
  type BadgeTheme,
  type BadgeSize
} from '../../data/awardBadgesData';
import { TekTrakkerAwardBadge } from '../../components/features/awards/TekTrakkerAwardBadge';
import PublicMultiAwardWidget from '../public/PublicMultiAwardWidget';
import { openPrintableCertificate } from '../../utils/CertificateGenerator';
import { useAppContext } from '../../context/AppContext';

export default function AwardProgramHub() {
  const { state } = useAppContext();
  const [allAwards, setAllAwards] = useState<TekTrakkerAward[]>([]);
  const [selectedAwardId, setSelectedAwardId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'my_awards' | 'widget_builder' | 'downloads'>('my_awards');
  const [widgetMode, setWidgetMode] = useState<'single' | 'multi'>('single');

  // Customizer state
  const [selectedTheme, setSelectedTheme] = useState<BadgeTheme>('gold_luxury');
  const [selectedSize, setSelectedSize] = useState<BadgeSize>('md');
  const [embedType, setEmbedType] = useState<'script' | 'iframe' | 'react' | 'jsonld'>('script');
  const [widgetLayout, setWidgetLayout] = useState<'full' | 'footer'>('full');
  const [copiedType, setCopiedType] = useState<string | null>(null);

  // Determine current org ID
  const currentOrgId = state.currentOrganization?.id || state.currentUser?.organizationId || 'org_apex_hvac';

  useEffect(() => {
    const loaded = getStoredAwards();
    setAllAwards(loaded);
    const orgAwards = loaded.filter((a) => a.orgId === currentOrgId || currentOrgId === 'org_apex_hvac');
    const firstAward = orgAwards[0] || loaded[0];
    if (firstAward) {
      setSelectedAwardId(firstAward.id);
      setSelectedTheme(firstAward.badgeTheme);
    }
  }, [currentOrgId]);

  const currentOrgLogo =
    state.currentOrganization?.logoUrl ||
    (state.currentOrganization as any)?.letterheadDataUrl ||
    (state.currentOrganization as any)?.branding?.logoUrl ||
    (state.currentOrganization?.id === 'org-1765817997819'
      ? 'https://firebasestorage.googleapis.com/v0/b/tektrakker.firebasestorage.app/o/public_assets%2Forg-1765817997819%2Flogo_stable_1774702115808.png?alt=media&token=08c347fe-a7b0-40d9-b23f-6a2adecf63e9'
      : '');

  // Filter awards presented to this organization (or all if demo org)
  const myAwards = allAwards
    .filter((a) => a.orgId === currentOrgId || currentOrgId === 'org_apex_hvac')
    .map((a) => ({
      ...a,
      orgLogo: currentOrgLogo || a.orgLogo
    }));
  const selectedAward = myAwards.find((a) => a.id === selectedAwardId) || myAwards[0] || allAwards[0];

  const handleClaimAward = (id: string) => {
    const updated = allAwards.map((item) =>
      item.id === id
        ? {
            ...item,
            claimed: true,
            claimedAt: new Date().toISOString(),
            enabledForWidget: true
          }
        : item
    );
    setAllAwards(updated);
    saveStoredAwards(updated);
  };

  const handleToggleAwardForWidget = (id: string) => {
    const updated = allAwards.map((item) =>
      item.id === id
        ? {
            ...item,
            enabledForWidget: item.enabledForWidget === false ? true : false
          }
        : item
    );
    setAllAwards(updated);
    saveStoredAwards(updated);
  };

  const handleCopyCode = (code: string, typeKey: string) => {
    navigator.clipboard.writeText(code);
    setCopiedType(typeKey);
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleDownloadSvg = (award: TekTrakkerAward) => {
    if (!award) return;
    const badgeElement = document.getElementById(`badge-svg-${award.id}`);
    if (!badgeElement) return;

    const svgData = new XMLSerializer().serializeToString(badgeElement.querySelector('svg') || badgeElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    const downloadLink = document.createElement('a');
    downloadLink.href = svgUrl;
    downloadLink.download = `TekTrakker_Award_${award.id}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const handleDownloadPng = (award: TekTrakkerAward) => {
    if (!award) return;
    const badgeContainer = document.getElementById(`badge-svg-${award.id}`);
    const svgElement = badgeContainer?.querySelector('svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 580;
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      if (ctx) {
        ctx.drawImage(img, 0, 0, 480, 580);
        const pngUrl = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = `TekTrakker_Award_${award.id}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      {/* Top Banner Header */}
      <div className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-slate-900 via-amber-950/30 to-slate-900 border border-amber-500/30 rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
          <Trophy className="w-80 h-80 text-amber-400" />
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              TekTrakker Business Recognition Program
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              Verified Business Awards & Recognition
            </h1>
            <p className="text-slate-400 text-sm md:text-base mt-2 max-w-2xl">
              TekTrakker rates and presents official awards to top-performing field service businesses.
              View your organization’s honors, claim your awards, and display verified badges on your website via interactive widgets or download high-res assets.
            </p>

            <div className="inline-flex items-center gap-2 mt-4 px-3.5 py-1.5 rounded-xl bg-slate-950/80 border border-amber-500/20 text-xs text-amber-300">
              <Info className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Official TekTrakker Awards are issued exclusively by <strong>Platform Master Admin</strong> based on verified field performance & compliance telemetry.</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-900/80 backdrop-blur border border-slate-800 p-4 rounded-xl">
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-400">{myAwards.length}</div>
              <div className="text-[11px] text-slate-400 font-semibold uppercase">Awards Received</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-400">
                {myAwards.filter((a) => a.claimed).length}
              </div>
              <div className="text-[11px] text-slate-400 font-semibold uppercase">Claimed & Active</div>
            </div>
            <div className="text-center col-span-2 sm:col-span-1">
              <div className="text-2xl font-bold text-sky-400">
                {myAwards.length > 0 ? (myAwards.reduce((acc, curr) => acc + curr.overallScore, 0) / myAwards.length).toFixed(1) : '98.5'} / 100
              </div>
              <div className="text-[11px] text-slate-400 font-semibold uppercase">Avg Excellence Score</div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-8 border-t border-slate-800 pt-4">
          <button
            onClick={() => setActiveTab('my_awards')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'my_awards'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Trophy className="w-4 h-4" />
            My Presented Awards ({myAwards.length})
          </button>
          <button
            onClick={() => setActiveTab('widget_builder')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'widget_builder'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Code className="w-4 h-4" />
            Website Widget Generator
          </button>
          <button
            onClick={() => setActiveTab('downloads')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'downloads'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Download className="w-4 h-4" />
            Downloads & Certificates
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* TAB 1: MY PRESENTED AWARDS */}
        {activeTab === 'my_awards' && (
          <div className="space-y-6">
            {myAwards.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-xl mx-auto space-y-4">
                <Trophy className="w-16 h-16 text-slate-600 mx-auto" />
                <h3 className="text-xl font-bold text-white">No Awards Received Yet</h3>
                <p className="text-xs text-slate-400">
                  TekTrakker Master Admin evaluates organization performance, first-time fix rates, and safety metrics. Awards issued by Master Admin will automatically appear here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {myAwards.map((award) => (
                  <div
                    key={award.id}
                    className={`bg-slate-900 border rounded-2xl p-6 transition-all relative flex flex-col justify-between ${
                      selectedAwardId === award.id
                        ? 'border-amber-500/80 ring-2 ring-amber-500/30 bg-slate-900/90'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Status Tag */}
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                          award.claimed
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {award.claimed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AwardIcon className="w-3.5 h-3.5" />}
                        {award.claimed ? 'Claimed & Verified' : 'Pending Acceptance'}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">ID: {award.verificationCode}</span>
                    </div>

                    {/* Widget Showcase Checkmark Toggle */}
                    {award.claimed && (
                      <div className="mb-3 p-2 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
                        <label htmlFor={`toggle-widget-${award.id}`} className="text-xs text-slate-300 font-bold flex items-center gap-2 cursor-pointer select-none">
                          <input
                            id={`toggle-widget-${award.id}`}
                            type="checkbox"
                            checked={award.enabledForWidget !== false}
                            onChange={() => handleToggleAwardForWidget(award.id)}
                            className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                          />
                          Display in Org Widget
                        </label>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${award.enabledForWidget !== false ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>
                          {award.enabledForWidget !== false ? 'Active' : 'Hidden'}
                        </span>
                      </div>
                    )}

                    {/* Badge Preview Center */}
                    <div className="flex justify-center my-4 py-2" id={`badge-svg-${award.id}`}>
                      <TekTrakkerAwardBadge
                        award={award}
                        theme={award.badgeTheme}
                        size="md"
                        showVerificationButton={true}
                      />
                    </div>

                    {/* Rating Metrics Scorecard */}
                    <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 my-4 space-y-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-400 font-bold uppercase tracking-wider">TekTrakker Scorecard</span>
                        <span className="text-amber-400 font-bold">{award.overallScore} / 100</span>
                      </div>

                      {award.metrics.map((m, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-300">{m.name}</span>
                            <span className="text-slate-400 font-mono">{m.score}%</span>
                          </div>
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full"
                              style={{ width: `${m.score}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="pt-2 space-y-2">
                      {!award.claimed ? (
                        <button
                          onClick={() => handleClaimAward(award.id)}
                          className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold rounded-xl hover:from-amber-400 hover:to-amber-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                        >
                          <ShieldCheck className="w-5 h-5" />
                          Accept Award & Activate Badge
                        </button>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => {
                              setSelectedAwardId(award.id);
                              setSelectedTheme(award.badgeTheme);
                              setActiveTab('widget_builder');
                            }}
                            className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
                          >
                            <Code className="w-4 h-4 text-amber-400" />
                            Get Widget Code
                          </button>
                          <button
                            onClick={() => openPrintableCertificate(award)}
                            className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
                          >
                            <FileText className="w-4 h-4 text-emerald-400" />
                            Print Certificate
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: WEBSITE WIDGET GENERATOR */}
        {activeTab === 'widget_builder' && selectedAward && (
          <div className="space-y-6">
            {/* Widget Display Mode Selector */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  Select Widget Embedding Type
                </h4>
                <p className="text-xs text-slate-400">
                  Choose between embedding a single dedicated award badge or a multi-award organization showcase widget.
                </p>
              </div>

              <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                <button
                  onClick={() => setWidgetMode('single')}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                    widgetMode === 'single'
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <AwardIcon className="w-4 h-4" /> Single Award Badge
                </button>
                <button
                  onClick={() => setWidgetMode('multi')}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                    widgetMode === 'multi'
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Trophy className="w-4 h-4" /> Multi-Award Showcase Widget ({myAwards.filter(a => a.claimed && a.enabledForWidget !== false).length})
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left: Customizer Controls */}
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                {widgetMode === 'single' ? (
                  <>
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Layers className="w-5 h-5 text-amber-400" />
                        Customize Single Award Badge
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Select your active award and customize the visual theme for your company website.
                      </p>
                    </div>

                    {/* Award Selector */}
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Select Award</label>
                      <select
                        value={selectedAwardId}
                        onChange={(e) => {
                          setSelectedAwardId(e.target.value);
                          const sel = myAwards.find((a) => a.id === e.target.value);
                          if (sel) setSelectedTheme(sel.badgeTheme);
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-sm text-white focus:border-amber-500 focus:outline-none"
                      >
                        {myAwards.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.category} ({a.year})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Badge Theme */}
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Badge Visual Theme</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'gold_luxury', label: 'Gold Luxury', color: 'border-amber-500 bg-amber-950/20' },
                          { id: 'platinum_elite', label: 'Platinum Elite', color: 'border-sky-400 bg-sky-950/20' },
                          { id: 'diamond_titan', label: 'Diamond Titan', color: 'border-blue-500 bg-blue-950/20' },
                          { id: 'emerald_eco', label: 'Emerald Eco', color: 'border-emerald-500 bg-emerald-950/20' },
                          { id: 'cyber_tech', label: 'Cyber Tech', color: 'border-purple-500 bg-purple-950/20' },
                        ].map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setSelectedTheme(t.id as BadgeTheme)}
                            className={`p-3 rounded-xl border text-xs font-bold text-left transition-all ${t.color} ${
                              selectedTheme === t.id
                                ? 'ring-2 ring-amber-400 text-white font-extrabold'
                                : 'opacity-70 hover:opacity-100'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Badge Size */}
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Badge Size</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['sm', 'md', 'lg'] as BadgeSize[]).map((s) => (
                          <button
                            key={s}
                            onClick={() => setSelectedSize(s)}
                            className={`py-2 px-3 rounded-xl border text-xs font-bold uppercase transition-all ${
                              selectedSize === s
                                ? 'bg-amber-500 text-slate-950 border-amber-400'
                                : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            {s === 'sm' ? 'Small (160px)' : s === 'md' ? 'Medium (240px)' : 'Large (340px)'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-amber-400" />
                        Multi-Award Showcase Builder
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Use the checkmarks below to select which earned awards appear in your embedded Organization Showcase Widget.
                      </p>
                    </div>

                    {/* Award Checkmarks List */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Checkmark Awards to Include</label>
                      <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                        {myAwards.filter(a => a.claimed).map((a) => (
                          <div
                            key={a.id}
                            onClick={() => handleToggleAwardForWidget(a.id)}
                            className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                              a.enabledForWidget !== false
                                ? 'bg-slate-950 border-amber-500/60 text-white'
                                : 'bg-slate-950/50 border-slate-800 text-slate-400 opacity-60'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={a.enabledForWidget !== false}
                                onChange={() => {}}
                                className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                              />
                              <div>
                                <p className="text-xs font-bold">{a.category}</p>
                                <p className="text-[10px] text-slate-400">{a.year} • Score {a.overallScore}</p>
                              </div>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${a.enabledForWidget !== false ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-500'}`}>
                              {a.enabledForWidget !== false ? 'Included' : 'Excluded'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Widget Visual Theme */}
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Showcase Visual Theme</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'gold_luxury', label: 'Gold Luxury', color: 'border-amber-500 bg-amber-950/20' },
                          { id: 'platinum_elite', label: 'Platinum Elite', color: 'border-sky-400 bg-sky-950/20' },
                          { id: 'diamond_titan', label: 'Diamond Titan', color: 'border-blue-500 bg-blue-950/20' },
                          { id: 'emerald_eco', label: 'Emerald Eco', color: 'border-emerald-500 bg-emerald-950/20' },
                          { id: 'cyber_tech', label: 'Cyber Tech', color: 'border-purple-500 bg-purple-950/20' },
                        ].map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setSelectedTheme(t.id as BadgeTheme)}
                            className={`p-3 rounded-xl border text-xs font-bold text-left transition-all ${t.color} ${
                              selectedTheme === t.id
                                ? 'ring-2 ring-amber-400 text-white font-extrabold'
                                : 'opacity-70 hover:opacity-100'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Widget Layout / Size Selector */}
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Showcase Layout / Size</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setWidgetLayout('full')}
                          className={`p-3 rounded-xl border text-xs font-bold text-left transition-all ${
                            widgetLayout === 'full'
                              ? 'bg-amber-500/20 border-amber-500 text-white font-extrabold ring-1 ring-amber-500'
                              : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          Full Showcase Card
                          <span className="block text-[10px] text-slate-400 font-normal mt-0.5">360px height (Body/Sidebar)</span>
                        </button>
                        <button
                          onClick={() => setWidgetLayout('footer')}
                          className={`p-3 rounded-xl border text-xs font-bold text-left transition-all ${
                            widgetLayout === 'footer'
                              ? 'bg-amber-500/20 border-amber-500 text-white font-extrabold ring-1 ring-amber-500'
                              : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          Compact Footer Ribbon
                          <span className="block text-[10px] text-emerald-400 font-bold mt-0.5">95px height (Fits Footers!)</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* Embed Format Selector */}
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Embed Code Format</label>
                  <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                    {[
                      { id: 'script', label: 'HTML Script' },
                      { id: 'iframe', label: 'iFrame' },
                      { id: 'react', label: 'React' },
                      ...(widgetMode === 'single' ? [{ id: 'jsonld', label: 'SEO JSON-LD' }] : []),
                    ].map((type) => (
                      <button
                        key={type.id}
                        onClick={() => setEmbedType(type.id as any)}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                          embedType === type.id
                            ? 'bg-amber-500 text-slate-950 shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: Live Preview & Code Box */}
              <div className="lg:col-span-7 space-y-6">
                {/* Live Preview Container */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      Live Website Embed Preview ({widgetMode === 'single' ? 'Single Badge' : `Multi-Award Showcase - ${widgetLayout === 'footer' ? 'Footer Bar' : 'Full Card'}`})
                    </h4>
                    <span className="text-xs text-slate-400">Renders on external business website</span>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 flex items-center justify-center min-h-[140px] relative overflow-hidden bg-grid-white/[0.02]">
                    {widgetMode === 'single' ? (
                      <div id={`badge-svg-${selectedAward.id}`}>
                        <TekTrakkerAwardBadge
                          award={selectedAward}
                          theme={selectedTheme}
                          size={selectedSize}
                          showVerificationButton={true}
                        />
                      </div>
                    ) : (
                      <div className="w-full max-w-[850px]">
                        <PublicMultiAwardWidget
                          key={`${currentOrgId}_${selectedTheme}_${widgetLayout}_${myAwards.map((a) => `${a.id}:${a.enabledForWidget !== false}`).join('_')}`}
                          orgId={currentOrgId}
                          theme={selectedTheme}
                          layout={widgetLayout}
                          awards={myAwards}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Copy Embed Code Section */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Code className="w-4 h-4 text-emerald-400" />
                      Copy Embed Code Snippet ({widgetMode === 'single' ? 'Single Award' : `Multi-Award Showcase (${widgetLayout})`})
                    </h4>
                    <button
                      onClick={() => {
                        let codeToCopy = '';
                        if (widgetMode === 'single') {
                          codeToCopy =
                            embedType === 'script'
                              ? generateScriptEmbedCode(selectedAward, selectedTheme, selectedSize)
                              : embedType === 'iframe'
                              ? generateIframeEmbedCode(selectedAward, selectedTheme, selectedSize)
                              : embedType === 'react'
                              ? generateReactEmbedCode(selectedAward, selectedTheme)
                              : generateJsonLdSchema(selectedAward);
                        } else {
                          codeToCopy =
                            embedType === 'script'
                              ? generateMultiAwardScriptCode(currentOrgId, selectedTheme)
                              : embedType === 'iframe'
                              ? generateMultiAwardIframeCode(currentOrgId, selectedTheme, widgetLayout)
                              : generateMultiAwardReactCode(currentOrgId, selectedTheme, widgetLayout);
                        }
                        handleCopyCode(codeToCopy, `${widgetMode}_${embedType}`);
                      }}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-all flex items-center gap-1.5"
                    >
                      {copiedType === `${widgetMode}_${embedType}` ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Copied to Clipboard!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy Code
                        </>
                      )}
                    </button>
                  </div>

                  <pre className="bg-slate-950 border border-slate-800 text-emerald-400 font-mono text-xs p-4 rounded-xl overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {widgetMode === 'single' ? (
                      <>
                        {embedType === 'script' && generateScriptEmbedCode(selectedAward, selectedTheme, selectedSize)}
                        {embedType === 'iframe' && generateIframeEmbedCode(selectedAward, selectedTheme, selectedSize)}
                        {embedType === 'react' && generateReactEmbedCode(selectedAward, selectedTheme)}
                        {embedType === 'jsonld' && generateJsonLdSchema(selectedAward)}
                      </>
                    ) : (
                      <>
                        {embedType === 'script' && generateMultiAwardScriptCode(currentOrgId, selectedTheme)}
                        {embedType === 'iframe' && generateMultiAwardIframeCode(currentOrgId, selectedTheme, widgetLayout)}
                        {embedType === 'react' && generateMultiAwardReactCode(currentOrgId, selectedTheme, widgetLayout)}
                      </>
                    )}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: DOWNLOADS & CERTIFICATES */}
        {activeTab === 'downloads' && selectedAward && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* SVG Vector Download */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
                    <Code className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Scalable SVG Vector Badge</h3>
                  <p className="text-xs text-slate-400 mt-2">
                    High-definition scalable vector format for graphic designers, website banners, and marketing material.
                  </p>
                </div>
                <button
                  onClick={() => handleDownloadSvg(selectedAward)}
                  className="mt-6 w-full py-3 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 border border-slate-700"
                >
                  <Download className="w-4 h-4" />
                  Download .SVG Vector
                </button>
              </div>

              {/* PNG HD Download */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-4">
                    <AwardIcon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white">High-Res PNG Badge</h3>
                  <p className="text-xs text-slate-400 mt-2">
                    Transparent background PNG raster image optimized for social media posts, email signatures, and headers.
                  </p>
                </div>
                <button
                  onClick={() => handleDownloadPng(selectedAward)}
                  className="mt-6 w-full py-3 bg-slate-800 hover:bg-slate-700 text-sky-400 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 border border-slate-700"
                >
                  <Download className="w-4 h-4" />
                  Download .PNG Image
                </button>
              </div>

              {/* PDF Official Certificate */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
                    <FileText className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Official Printable Certificate</h3>
                  <p className="text-xs text-slate-400 mt-2">
                    Printable high-resolution landscape Certificate of Excellence with verification QR code and official seal.
                  </p>
                </div>
                <button
                  onClick={() => openPrintableCertificate(selectedAward)}
                  className="mt-6 w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-slate-950 font-bold text-sm rounded-xl hover:from-emerald-400 hover:to-emerald-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  <FileText className="w-4 h-4" />
                  Print / Save PDF Certificate
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
