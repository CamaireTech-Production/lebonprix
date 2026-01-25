import { FileBarChart, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@components/common';
import { useCompanyColors } from '@hooks/business/useCompanyColors';

interface DashboardHeaderProps {
  onViewReports: () => void;
  onShowGuide: () => void;
}

const DashboardHeader = ({ onViewReports, onShowGuide }: DashboardHeaderProps) => {
  const { t } = useTranslation();
  const colors = useCompanyColors();

  return (
    <div className="mb-6 rounded-lg overflow-hidden" style={{
      background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 50%, ${colors.tertiary} 100%)`,
      color: colors.headerText
    }}>
      <div className="px-6 py-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
          <div>
            <h1 className="text-3xl font-bold" style={{color: colors.headerText}}>
              {t('dashboard.title')}
            </h1>
            <p className="text-lg mt-1" style={{color: `${colors.headerText}CC`}}>
              {t('dashboard.welcome')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              icon={<FileBarChart size={16} />}
              onClick={onViewReports}
              className="bg-white/20 border-white/30 text-white hover:bg-white/30 backdrop-blur-sm"
            >
              {t('dashboard.viewTodayReports')}
            </Button>
            <Button
              variant="outline"
              icon={<Info size={16} />}
              onClick={onShowGuide}
              className="bg-white/20 border-white/30 text-white hover:bg-white/30 backdrop-blur-sm"
            >
              {t('dashboard.guide', { defaultValue: 'Guide' })}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;

