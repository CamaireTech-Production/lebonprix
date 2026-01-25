import { useTranslation } from 'react-i18next';
import DonutChart from './DonutChart';
import { SkeletonChart } from '@components/common';

interface DonutChartsSectionProps {
  salesByCategoryData: Array<{ category: string; amount: number }>;
  expensesByCategoryData: Array<{ category: string; amount: number; count: number }>;
  salesBySourceData: Array<{ source: string; amount: number; count: number }>;
  salesByPaymentStatusData: Array<{ status: string; amount: number; count: number }>;
  loading: {
    sales: boolean;
    products: boolean;
    expenses: boolean;
  };
}

const DonutChartsSection = ({
  salesByCategoryData,
  expensesByCategoryData,
  salesBySourceData,
  salesByPaymentStatusData,
  loading
}: DonutChartsSectionProps) => {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Sales by Product Category Chart */}
      {(loading.sales || loading.products) ? (
        <SkeletonChart />
      ) : (
        <DonutChart
          title={t('dashboard.salesByCategory.title', { defaultValue: 'Ventes par catégorie de produits' })}
          data={salesByCategoryData.map(item => ({
            label: item.category,
            value: item.amount
          }))}
        />
      )}

      {/* Expenses by Category Chart */}
      {loading.expenses ? (
        <SkeletonChart />
      ) : (
        <DonutChart
          title={t('dashboard.expensesByCategory.title', { defaultValue: 'Dépenses par catégorie' })}
          data={expensesByCategoryData.map(item => ({
            label: item.category,
            value: item.amount
          }))}
        />
      )}

      {/* Sales by Source Chart */}
      {loading.sales ? (
        <SkeletonChart />
      ) : (
        <DonutChart
          title={t('dashboard.salesBySource.title', { defaultValue: 'Ventes par source' })}
          data={salesBySourceData.map(item => ({
            label: item.source,
            value: item.amount
          }))}
        />
      )}

      {/* Sales by Payment Status Chart */}
      {loading.sales ? (
        <SkeletonChart />
      ) : (
        <DonutChart
          title={t('dashboard.salesByPaymentStatus.title', { defaultValue: 'Ventes par statut de paiement' })}
          data={salesByPaymentStatusData.map((item: { status: string; amount: number; count: number }) => ({
            label: item.status,
            value: item.amount
          }))}
        />
      )}
    </div>
  );
};

export default DonutChartsSection;

