import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import Card from '../common/Card';
import Badge from '../common/Badge';
import { useTranslation } from 'react-i18next';

interface Activity {
  id: string;
  title: string;
  description: string;
  timestamp: Date;
  type: 'sale' | 'expense' | 'product' | 'user';
}

interface ActivityListProps {
  activities: Activity[];
}

const ActivityList = ({ activities }: ActivityListProps) => {
  const { t, i18n } = useTranslation();

  const getActivityTypeDetails = (type: Activity['type']) => {
    switch (type) {
      case 'sale':
        return {
          variant: 'success' as const,
          label: t('dashboard.activity.types.sale')
        };
      case 'expense':
        return {
          variant: 'error' as const,
          label: t('dashboard.activity.types.expense')
        };
      case 'product':
        return {
          variant: 'info' as const,
          label: t('dashboard.activity.types.product')
        };
      case 'user':
        return {
          variant: 'default' as const,
          label: t('dashboard.activity.types.user')
        };
    }
  };

  return (
    <Card title={t('dashboard.activity.title')}>
      <div className="space-y-4">
        {activities.length === 0 ? (
          <p className="text-gray-500 text-center py-4">{t('dashboard.activity.noActivities')}</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {activities.map((activity) => {
              const { variant, label } = getActivityTypeDetails(activity.type);
              
              return (
                <li key={activity.id} className="py-3">
                  <div className="flex justify-between">
                    <Badge variant={variant}>{label}</Badge>
                    <span className="text-xs text-gray-500">
                      {formatDistanceToNow(activity.timestamp, { 
                        addSuffix: true,
                        locale: i18n.language === 'fr' ? fr : undefined 
                      })}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {activity.title === 'New sale recorded' ? t('dashboard.activity.titles.newSale') :
                     activity.title === 'Expense added' ? t('dashboard.activity.titles.expenseAdded') :
                     activity.title === 'New product added' ? t('dashboard.activity.titles.productAdded') :
                     activity.title === 'Product updated' ? t('dashboard.activity.titles.productUpdated') :
                     activity.title === 'New user added' ? t('dashboard.activity.titles.userAdded') :
                     activity.title === 'User updated' ? t('dashboard.activity.titles.userUpdated') :
                     activity.title}
                  </p>
                  <p className="text-sm text-gray-600">{activity.description}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
};

export default ActivityList;