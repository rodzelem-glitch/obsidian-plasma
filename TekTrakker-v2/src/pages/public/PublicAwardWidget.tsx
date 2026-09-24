import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getStoredAwards, type BadgeTheme, type BadgeSize } from '../../data/awardBadgesData';
import { TekTrakkerAwardBadge } from '../../components/features/awards/TekTrakkerAwardBadge';

export default function PublicAwardWidget() {
  const { awardId } = useParams<{ awardId: string }>();
  const [searchParams] = useSearchParams();

  const theme = (searchParams.get('theme') as BadgeTheme) || 'gold_luxury';
  const size = (searchParams.get('size') as BadgeSize) || 'md';

  const awards = getStoredAwards();
  const award = awards.find((a) => a.id === awardId) || awards[0];

  const handleWidgetClick = () => {
    const verifyUrl = `${window.location.origin}/#/awards/verify/${award.id}`;
    window.open(verifyUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="bg-transparent flex items-center justify-center p-0 m-0 overflow-hidden w-full h-full min-h-screen">
      <TekTrakkerAwardBadge
        award={award}
        theme={theme}
        size={size}
        interactive={true}
        onClick={handleWidgetClick}
        showVerificationButton={false}
      />
    </div>
  );
}
