import React from 'react';
import type { TekTrakkerAward, BadgeTheme, BadgeSize } from '../../../data/awardBadgesData';

interface Props {
  award: TekTrakkerAward;
  theme?: BadgeTheme;
  size?: BadgeSize;
  interactive?: boolean;
  onClick?: () => void;
  showVerificationButton?: boolean;
}

export const TekTrakkerAwardBadge: React.FC<Props> = ({
  award,
  theme = award.badgeTheme || 'gold_luxury',
  size = 'md',
  interactive = true,
  onClick,
  showVerificationButton = false,
}) => {
  const currentTheme = theme || award.badgeTheme || 'gold_luxury';

  const dimensions = {
    sm: { width: 160, height: 200, scale: 0.7 },
    md: { width: 240, height: 290, scale: 1.0 },
    lg: { width: 340, height: 400, scale: 1.4 },
  }[size];

  // Colors & Gradients according to theme
  const themeConfig = {
    gold_luxury: {
      primaryGradient: ['#FFF8DB', '#F3C649', '#B8860B', '#8B6508'],
      secondaryGradient: ['#2A2415', '#16120B'],
      accentColor: '#FFD700',
      textColor: '#FFFFFF',
      subTextColor: '#E6C200',
      badgeBg: '#1A160D',
      borderColor: '#F3C649',
      glowColor: 'rgba(243, 198, 73, 0.4)',
      titleText: 'TEKTRAKKER GOLD AWARD',
      iconSymbol: '★'
    },
    platinum_elite: {
      primaryGradient: ['#FFFFFF', '#D9E2EC', '#9FB3C8', '#486581'],
      secondaryGradient: ['#0F172A', '#1E293B'],
      accentColor: '#38BDF8',
      textColor: '#FFFFFF',
      subTextColor: '#BAE6FD',
      badgeBg: '#0F172A',
      borderColor: '#7DD3FC',
      glowColor: 'rgba(56, 189, 248, 0.4)',
      titleText: 'PLATINUM ELITE 2026',
      iconSymbol: '❖'
    },
    diamond_titan: {
      primaryGradient: ['#F0F9FF', '#BAE6FD', '#38BDF8', '#0284C7'],
      secondaryGradient: ['#090D16', '#111827'],
      accentColor: '#60A5FA',
      textColor: '#FFFFFF',
      subTextColor: '#93C5FD',
      badgeBg: '#0B1329',
      borderColor: '#60A5FA',
      glowColor: 'rgba(96, 165, 250, 0.5)',
      titleText: 'DIAMOND TITAN AWARD',
      iconSymbol: '◆'
    },
    emerald_eco: {
      primaryGradient: ['#ECFDF5', '#34D399', '#059669', '#064E3B'],
      secondaryGradient: ['#022C22', '#064E3B'],
      accentColor: '#10B981',
      textColor: '#FFFFFF',
      subTextColor: '#6EE7B7',
      badgeBg: '#022C22',
      borderColor: '#34D399',
      glowColor: 'rgba(16, 185, 129, 0.4)',
      titleText: 'ECO-GREEN LEADER 2026',
      iconSymbol: '🍃'
    },
    cyber_tech: {
      primaryGradient: ['#F472B6', '#C084FC', '#818CF8', '#38BDF8'],
      secondaryGradient: ['#0B0F19', '#181E29'],
      accentColor: '#EC4899',
      textColor: '#FFFFFF',
      subTextColor: '#F472B6',
      badgeBg: '#090D16',
      borderColor: '#C084FC',
      glowColor: 'rgba(192, 132, 252, 0.5)',
      titleText: 'CYBER TECH TITAN',
      iconSymbol: '⚡'
    }
  }[currentTheme];

  return (
    <div
      className={`inline-flex flex-col items-center justify-center relative select-none transition-all duration-300 ${
        interactive ? 'hover:scale-[1.03] cursor-pointer' : ''
      }`}
      onClick={onClick}
      style={{
        width: dimensions.width,
        height: dimensions.height,
        filter: `drop-shadow(0 10px 25px ${themeConfig.glowColor})`
      }}
    >
      <svg
        width={dimensions.width}
        height={dimensions.height}
        viewBox="0 0 240 290"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full overflow-visible"
      >
        <defs>
          {/* Main Metallic Border Gradient */}
          <linearGradient id={`grad-primary-${currentTheme}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={themeConfig.primaryGradient[0]} />
            <stop offset="35%" stopColor={themeConfig.primaryGradient[1]} />
            <stop offset="70%" stopColor={themeConfig.primaryGradient[2]} />
            <stop offset="100%" stopColor={themeConfig.primaryGradient[3]} />
          </linearGradient>

          {/* Inner Shield Background Gradient */}
          <linearGradient id={`grad-bg-${currentTheme}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={themeConfig.secondaryGradient[0]} />
            <stop offset="100%" stopColor={themeConfig.secondaryGradient[1]} />
          </linearGradient>

          {/* Shimmer Light Reflection */}
          <linearGradient id={`grad-shine-${currentTheme}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
            <stop offset="30%" stopColor="#FFFFFF" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>

          {/* Ribbon Gradient */}
          <linearGradient id={`grad-ribbon-${currentTheme}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={themeConfig.primaryGradient[2]} />
            <stop offset="50%" stopColor={themeConfig.primaryGradient[1]} />
            <stop offset="100%" stopColor={themeConfig.primaryGradient[2]} />
          </linearGradient>

          {/* Drop Shadows & Glow */}
          <filter id={`glow-${currentTheme}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Org Logo Clip Circle */}
          <clipPath id={`org-logo-clip-${award.id}`}>
            <circle cx="0" cy="0" r="12" />
          </clipPath>
        </defs>

        {/* Outer Glow Halo */}
        <path
          d="M 120,12 C 175,12 218,32 218,85 C 218,170 160,230 120,252 C 80,230 22,170 22,85 C 22,32 65,12 120,12 Z"
          fill={themeConfig.borderColor}
          opacity="0.15"
          filter={`url(#glow-${currentTheme})`}
        />

        {/* Outer Shield Frame */}
        <path
          d="M 120,10 C 178,10 220,30 220,85 C 220,172 162,232 120,255 C 78,232 20,172 20,85 C 20,30 62,10 120,10 Z"
          fill={`url(#grad-primary-${currentTheme})`}
          stroke={themeConfig.borderColor}
          strokeWidth="1.5"
        />

        {/* Inner Shield Body */}
        <path
          d="M 120,18 C 172,18 210,36 210,87 C 210,166 156,222 120,244 C 84,222 30,166 30,87 C 30,36 68,18 120,18 Z"
          fill={`url(#grad-bg-${currentTheme})`}
          stroke={themeConfig.borderColor}
          strokeWidth="1"
          opacity="0.95"
        />

        {/* Top Metallic Shimmer Curve */}
        <path
          d="M 120,18 C 172,18 210,36 210,87 C 210,115 195,135 170,140 C 130,100 70,100 30,87 C 30,36 68,18 120,18 Z"
          fill={`url(#grad-shine-${currentTheme})`}
        />

        {/* Laurels / Decorative Wreath Lines */}
        <g stroke={themeConfig.accentColor} strokeWidth="1.2" opacity="0.35" fill="none">
          <path d="M 45,110 C 42,145 65,185 100,205" strokeDasharray="3 3" />
          <path d="M 195,110 C 198,145 175,185 140,205" strokeDasharray="3 3" />
        </g>

        {/* TekTrakker Brand Icon Header */}
        <image
          href="tektrakker-icon.png"
          x="109"
          y="15"
          width="22"
          height="22"
          preserveAspectRatio="xMidYMid meet"
        />

        {/* Header Org Rating Header */}
        <text
          x="120"
          y="44"
          textAnchor="middle"
          fill={themeConfig.subTextColor}
          fontSize="7.5"
          fontWeight="900"
          letterSpacing="1.2"
          className="uppercase"
        >
          TekTrakker Certified
        </text>

        {/* Receiving Organization Logo / Emblem Ring */}
        <g transform="translate(120, 62)">
          <circle cx="0" cy="0" r="14" fill={themeConfig.badgeBg} stroke={themeConfig.accentColor} strokeWidth="1.5" />
          <image
            href={award.orgLogo || 'https://firebasestorage.googleapis.com/v0/b/tektrakker.firebasestorage.app/o/public_assets%2Forg-1765817997819%2Flogo_stable_1774702115808.png?alt=media&token=08c347fe-a7b0-40d9-b23f-6a2adecf63e9'}
            x="-12"
            y="-12"
            width="24"
            height="24"
            clipPath={`url(#org-logo-clip-${award.id})`}
            preserveAspectRatio="xMidYMid slice"
          />
        </g>

        {/* Category Title / Award Title */}
        <text
          x="120"
          y="88"
          textAnchor="middle"
          fill={themeConfig.textColor}
          fontSize="10.5"
          fontWeight="900"
          letterSpacing="0.5"
        >
          {award.category.length > 26 ? `${award.category.substring(0, 24)}...` : award.category}
        </text>

        {/* Company Name */}
        <text
          x="120"
          y="103"
          textAnchor="middle"
          fill={themeConfig.accentColor}
          fontSize="12.5"
          fontWeight="bold"
        >
          {award.orgName.length > 22 ? `${award.orgName.substring(0, 20)}...` : award.orgName}
        </text>

        {/* Rating Score Pill */}
        <g transform="translate(65, 114)">
          <rect
            x="0"
            y="0"
            width="110"
            height="32"
            rx="16"
            fill={`url(#grad-primary-${currentTheme})`}
            opacity="0.9"
          />
          <rect
            x="2"
            y="2"
            width="106"
            height="28"
            rx="14"
            fill={themeConfig.badgeBg}
          />
          <text
            x="55"
            y="20"
            textAnchor="middle"
            fill={themeConfig.textColor}
            fontSize="15"
            fontWeight="900"
            letterSpacing="0.5"
          >
            SCORE {award.overallScore.toFixed(1)}
          </text>
        </g>

        {/* 5-Star Rating Icons */}
        <g transform="translate(120, 162)">
          <text textAnchor="middle" fill="#FFD700" fontSize="13" letterSpacing="3">
            ★★★★★
          </text>
        </g>

        {/* Percentile Rank */}
        <text
          x="120"
          y="184"
          textAnchor="middle"
          fill={themeConfig.subTextColor}
          fontSize="9.5"
          fontWeight="700"
          letterSpacing="0.8"
        >
          {award.percentile}
        </text>

        {/* Bottom Banner Ribbon */}
        <g transform="translate(0, 215)">
          {/* Ribbon Back Folds */}
          <path d="M 25,25 L 35,5 L 35,32 Z" fill={themeConfig.secondaryGradient[1]} />
          <path d="M 215,25 L 205,5 L 205,32 Z" fill={themeConfig.secondaryGradient[1]} />

          {/* Main Ribbon Body */}
          <rect
            x="24"
            y="0"
            width="192"
            height="26"
            rx="4"
            fill={`url(#grad-ribbon-${currentTheme})`}
            stroke={themeConfig.borderColor}
            strokeWidth="0.8"
          />

          {/* Ribbon Text */}
          <text
            x="120"
            y="17"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="10"
            fontWeight="900"
            letterSpacing="1.2"
          >
            OFFICIAL WINNER {award.year}
          </text>
        </g>

        {/* Official TekTrakker Security Stamp Seal */}
        <g transform="translate(120, 266)">
          <circle r="12" fill={themeConfig.badgeBg} stroke={themeConfig.borderColor} strokeWidth="1.2" />
          <text
            x="0"
            y="4"
            textAnchor="middle"
            fill={themeConfig.accentColor}
            fontSize="8"
            fontWeight="900"
            letterSpacing="0.5"
          >
            TT
          </text>
        </g>
      </svg>

      {showVerificationButton && (
        <a
          href={`${typeof window !== 'undefined' ? window.location.origin : ''}/#/awards/verify/${award?.id || ''}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 text-[11px] font-bold text-amber-400 hover:text-amber-300 underline tracking-wide flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          ✓ Verify Authenticity
        </a>
      )}
    </div>
  );
};
