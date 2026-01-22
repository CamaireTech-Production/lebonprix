import { useTranslation } from 'react-i18next';
import { DollarSign, TrendingUp, Receipt, Users, Clock } from 'lucide-react';
import StatCard from './StatCard';
import { SkeletonStatCard } from '@components/common';
import { useCompanyColors } from '@hooks/business/useCompanyColors';
import type { StatCardData } from '@hooks/business/useDashboardStats';

interface StatsSectionProps {
  statCards: StatCardData[];
}

const getIcon = (iconType: StatCardData['iconType']) => {
  switch (iconType) {
    case 'dollar':
      return <DollarSign size={20} />;
    case 'trending':
      return <TrendingUp size={20} />;
    case 'receipt':
      return <Receipt size={20} />;
    case 'users':
      return <Users size={20} />;
    case 'credit':
      return <Clock size={20} />;
    default:
      return <DollarSign size={20} />;
  }
};

const StatsSection = ({ statCards }: StatsSectionProps) => {
  const { t } = useTranslation();
  const colors = useCompanyColors();

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-lg font-semibold" style={{color: colors.primary}}>
          {t('dashboard.stats.title')}
        </h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statCards.map((card, index) => (
          card.loading ? (
            <SkeletonStatCard key={`skeleton-${index}`} />
          ) : (
            <StatCard
              key={index}
              title={card.title}
              value={card.value}
              icon={getIcon(card.iconType)}
              type={card.type}
              trend={card.trend}
              trendData={card.trendData}
              periodLabel={card.periodLabel}
              subtitle={card.subtitle}
            />
          )
        ))}
      </div>
    </div>
  );
};

export default StatsSection;

