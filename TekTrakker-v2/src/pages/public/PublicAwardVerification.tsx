import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShieldCheck, Award, Star, CheckCircle2, Building2, Calendar, Lock, ExternalLink } from 'lucide-react';
import { getStoredAwards, INITIAL_AWARDS, type BadgeTheme } from '../../data/awardBadgesData';
import { TekTrakkerAwardBadge } from '../../components/features/awards/TekTrakkerAwardBadge';

export default function PublicAwardVerification() {
  const { awardId } = useParams<{ awardId?: string }>();
  const awards = getStoredAwards();
  const award = (awardId ? awards.find((a) => a.id === awardId) : null) || awards[0] || INITIAL_AWARDS[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 md:p-8">
      {/* Background ambient glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-950/20 via-slate-950 to-slate-950" />

      <div className="max-w-3xl w-full bg-slate-900/90 backdrop-blur-xl border border-amber-500/30 rounded-3xl p-6 md:p-10 shadow-2xl relative z-10 space-y-8">
        {/* Top Official Brand Header */}
        <div className="flex items-center justify-center pt-1">
          <img src="tektrakker-logo-web.png" alt="TekTrakker" className="h-8 md:h-10 w-auto object-contain drop-shadow" />
        </div>

        {/* Verification Status Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            Official Verified Award Recognition
          </div>

          <h1 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight">
            TekTrakker Award Verification
          </h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            This page confirms the authentic TekTrakker Business Rating Certification issued to{' '}
            <span className="text-amber-400 font-bold">{award.orgName}</span>.
          </p>
        </div>

        {/* Center Badge Card */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 bg-slate-950/80 border border-slate-800 rounded-2xl p-6 md:p-8">
          <div className="scale-105">
            <TekTrakkerAwardBadge award={award} theme={award.badgeTheme} size="md" interactive={false} />
          </div>

          <div className="space-y-4 text-center md:text-left flex-1">
            <div className="flex items-center gap-3 justify-center md:justify-start">
              <img
                src={award.orgLogo || 'https://firebasestorage.googleapis.com/v0/b/tektrakker.firebasestorage.app/o/public_assets%2Forg-1765817997819%2Flogo_stable_1774702115808.png?alt=media&token=08c347fe-a7b0-40d9-b23f-6a2adecf63e9'}
                alt={award.orgName}
                className="w-10 h-10 rounded-xl object-cover border border-slate-800 shrink-0 shadow-lg"
              />
              <div>
                <span className="text-xs font-bold uppercase text-amber-400 tracking-wider block">Award Title</span>
                <h2 className="text-xl font-bold text-white mt-0.5">{award.category}</h2>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
                <span className="text-slate-400 block">Overall Score</span>
                <span className="text-base font-extrabold text-amber-400">{award.overallScore} / 100</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
                <span className="text-slate-400 block">Industry Rank</span>
                <span className="text-base font-extrabold text-emerald-400">{award.percentile}</span>
              </div>
            </div>

            <div className="text-xs text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 justify-center md:justify-start">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Issued Date: <strong className="text-slate-200">{award.issuedDate}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 justify-center md:justify-start">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span>Verification Code: <strong className="text-slate-200 font-mono">{award.verificationCode}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Scorecard Breakdown */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-amber-400" />
            Verified Rating Scorecard & Metrics
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {award.metrics.map((m, idx) => (
              <div key={idx} className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-200">{m.name}</span>
                  <span className="font-bold text-amber-400">{m.score}%</span>
                </div>
                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full" style={{ width: `${m.score}%` }} />
                </div>
                <div className="text-[10px] text-slate-400">Benchmark: {m.benchmark}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer info */}
        <div className="border-t border-slate-800 pt-6 text-center text-xs text-slate-400 space-y-2">
          <p>© 2026 TekTrakker Inc. All ratings verified by TekTrakker Field Telemetry & Customer Audits.</p>
          <a href="/#/login" className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 font-semibold">
            Learn more about TekTrakker Business Recognition <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
