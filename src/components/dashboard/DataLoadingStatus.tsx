import { useCompanyColors } from '@hooks/business/useCompanyColors';

interface DataLoadingStatusProps {
  loadingAllSales: boolean;
  allSalesCount: number;
  recentSalesCount: number;
}

const DataLoadingStatus = ({ loadingAllSales, allSalesCount, recentSalesCount }: DataLoadingStatusProps) => {
  const colors = useCompanyColors();

  if (loadingAllSales) {
    return (
      <div className="p-4 rounded-lg border-2" style={{
        backgroundColor: `${colors.primary}20`,
        borderColor: `${colors.primary}40`
      }}>
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 mr-3" style={{borderColor: colors.primary}}></div>
          <span className="text-sm font-medium" style={{color: colors.primary}}>
            Loading complete sales history for accurate calculations...
          </span>
        </div>
      </div>
    );
  }

  if (allSalesCount > 0 && allSalesCount > recentSalesCount) {
    return (
      <div className="p-4 rounded-lg border-2" style={{
        backgroundColor: `${colors.secondary}20`,
        borderColor: `${colors.secondary}40`
      }}>
        <div className="flex items-center">
          <div className="h-5 w-5 rounded-full mr-3" style={{backgroundColor: colors.secondary}}></div>
          <span className="text-sm font-medium" style={{color: colors.secondary}}>
            Complete data loaded: {allSalesCount} total sales (showing calculations for all data)
          </span>
        </div>
      </div>
    );
  }

  return null;
};

export default DataLoadingStatus;

