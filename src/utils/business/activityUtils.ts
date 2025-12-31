export interface Activity {
  id: string;
  title: string;
  description: string;
  timestamp: Date;
  type: 'sale' | 'expense' | 'product' | 'user' | 'objective' | 'finance' | 'supplier';
}

export const convertAuditLogToActivity = (auditLog: any): Activity => {
  const { action, entityType, changes, timestamp } = auditLog;
  
  let title = '';
  let description = '';
  let type: Activity['type'] = 'user';

  switch (entityType) {
    case 'objective':
      type = 'objective';
      if (action === 'create') {
        title = 'Objective added';
        description = `Added objective: ${changes?.title || 'New objective'}`;
      } else if (action === 'update') {
        title = 'Objective updated';
        description = `Updated objective: ${changes?.newValue?.title || 'Objective'}`;
      } else if (action === 'delete') {
        title = 'Objective deleted';
        description = `Deleted objective: ${changes?.title || 'Objective'}`;
      }
      break;
    
    case 'product':
      type = 'product';
      if (action === 'create') {
        title = 'New product added';
        description = `Added product: ${changes?.name || 'New product'}`;
      } else if (action === 'update') {
        title = 'Product updated';
        description = `Updated product: ${changes?.newValue?.name || 'Product'}`;
      } else if (action === 'delete') {
        title = 'Product deleted';
        description = `Deleted product: ${changes?.name || 'Product'}`;
      }
      break;
    
    case 'sale':
      type = 'sale';
      if (action === 'create') {
        title = 'New sale recorded';
        description = `Sale recorded for ${changes?.totalAmount?.toLocaleString() || 0} XAF`;
      } else if (action === 'update') {
        title = 'Sale updated';
        description = `Updated sale: ${changes?.newValue?.totalAmount?.toLocaleString() || 0} XAF`;
      } else if (action === 'delete') {
        title = 'Sale deleted';
        description = `Deleted sale: ${changes?.totalAmount?.toLocaleString() || 0} XAF`;
      }
      break;
    
    case 'expense':
      type = 'expense';
      if (action === 'create') {
        title = 'Expense added';
        description = `${changes?.description || 'Expense'}: ${changes?.amount?.toLocaleString() || 0} XAF`;
      } else if (action === 'update') {
        title = 'Expense updated';
        description = `${changes?.newValue?.description || 'Expense'}: ${changes?.newValue?.amount?.toLocaleString() || 0} XAF`;
      } else if (action === 'delete') {
        title = 'Expense deleted';
        description = `${changes?.description || 'Expense'}: ${changes?.amount?.toLocaleString() || 0} XAF`;
      }
      break;
    
    case 'finance':
      type = 'finance';
      if (action === 'create') {
        title = 'Finance entry added';
        description = `${changes?.description || 'Entry'}: ${changes?.amount?.toLocaleString() || 0} XAF`;
      } else if (action === 'update') {
        title = 'Finance entry updated';
        description = `${changes?.newValue?.description || 'Entry'}: ${changes?.newValue?.amount?.toLocaleString() || 0} XAF`;
      } else if (action === 'delete') {
        title = 'Finance entry deleted';
        description = `${changes?.description || 'Entry'}: ${changes?.amount?.toLocaleString() || 0} XAF`;
      }
      break;
    
    case 'supplier':
      type = 'supplier';
      if (action === 'create') {
        title = 'Supplier added';
        description = `Added supplier: ${changes?.name || 'New supplier'}`;
      } else if (action === 'update') {
        title = 'Supplier updated';
        description = `Updated supplier: ${changes?.newValue?.name || 'Supplier'}`;
      } else if (action === 'delete') {
        title = 'Supplier deleted';
        description = `Deleted supplier: ${changes?.name || 'Supplier'}`;
      }
      break;
    
    default:
      type = 'user';
      title = `${action.charAt(0).toUpperCase() + action.slice(1)} ${entityType}`;
      description = `${action} operation on ${entityType}`;
  }

  return {
    id: auditLog.id,
    title,
    description,
    timestamp: timestamp?.seconds ? new Date(timestamp.seconds * 1000) : new Date(),
    type
  };
};

export const combineActivities = (
  sales: any[] = [],
  expenses: any[] = [],
  auditLogs: any[] = [],
  t: any
): Activity[] => {
  const activities: Activity[] = [];

  // Add sales activities
  activities.push(...sales.slice(0, 3).map(sale => ({
    id: sale.id,
    title: t('dashboard.activity.titles.newSale'),
    description: `${sale.customerInfo?.name || 'Customer'} purchased items for ${sale.totalAmount?.toLocaleString() || 0} XAF`,
    timestamp: sale.createdAt?.seconds ? new Date(sale.createdAt.seconds * 1000) : new Date(),
    type: 'sale' as const,
  })));

  // Add expenses activities
  activities.push(...expenses.slice(0, 3).map(expense => ({
    id: expense.id,
    title: t('dashboard.activity.titles.expenseAdded'),
    description: `${expense.description || 'Expense'}: ${expense.amount?.toLocaleString() || 0} XAF`,
    timestamp: expense.createdAt?.seconds ? new Date(expense.createdAt.seconds * 1000) : new Date(),
    type: 'expense' as const,
  })));

  // Add audit log activities
  activities.push(...auditLogs.slice(0, 10).map(log => convertAuditLogToActivity(log)));

  // Sort by timestamp (newest first)
  return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};
