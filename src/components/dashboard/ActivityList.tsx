import { formatDistanceToNow } from 'date-fns';
import Card from '../common/Card';
import Badge from '../common/Badge';

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
  const getActivityTypeDetails = (type: Activity['type']) => {
    switch (type) {
      case 'sale':
        return {
          variant: 'success' as const,
          label: 'Sale'
        };
      case 'expense':
        return {
          variant: 'error' as const,
          label: 'Expense'
        };
      case 'product':
        return {
          variant: 'info' as const,
          label: 'Product'
        };
      case 'user':
        return {
          variant: 'default' as const,
          label: 'User'
        };
    }
  };

  return (
    <Card title="Recent Activity">
      <div className="space-y-4">
        {activities.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No recent activities</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {activities.map((activity) => {
              const { variant, label } = getActivityTypeDetails(activity.type);
              
              return (
                <li key={activity.id} className="py-3">
                  <div className="flex justify-between">
                    <Badge variant={variant}>{label}</Badge>
                    <span className="text-xs text-gray-500">
                      {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-gray-900">{activity.title}</p>
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