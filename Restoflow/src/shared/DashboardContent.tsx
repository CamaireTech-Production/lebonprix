import React, { useMemo, useEffect, useState } from 'react';
import { Copy, UtensilsCrossed, Layers, ClipboardList, ShoppingCart, BarChart2, User, Truck, Eye } from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { toast } from 'react-hot-toast';
import designSystem from '../designSystem';
import { useLanguage } from '../contexts/LanguageContext';
import { t } from '../utils/i18n';
import { getCurrencySymbol } from '../data/currencies';
import { subscribeToVisitorStats, VisitorStats } from '../services/visitorTrackingService';


interface DashboardContentProps {
  restaurant: any;
  orders: any[];
  menuItems: any[];
  categories: any[];
  isDemoUser: boolean;
  loading: boolean;
  children?: React.ReactNode;
}


const getOrderStatusColors = (status: string) => {
  const colors = designSystem.colors;
  switch (status) {
    case 'pending':
      return { background: colors.statusPendingBg, color: colors.statusPendingText };
    case 'preparing':
      return { background: colors.statusPreparingBg, color: colors.statusPreparingText };
    case 'ready':
      return { background: colors.statusReadyBg, color: colors.statusReadyText };
    case 'completed':
      return { background: colors.statusCompletedBg, color: colors.statusCompletedText };
    case 'cancelled':
      return { background: colors.statusCancelledBg, color: colors.statusCancelledText };
    default:
      return { background: colors.statusDefaultBg, color: colors.statusDefaultText };
  }
};

const DashboardContent: React.FC<DashboardContentProps> = ({ restaurant, orders, menuItems, categories, loading, children, isDemoUser }) => {
  // Memoized stats
  // Defensive: default to empty arrays if undefined
  const safeOrders = Array.isArray(orders) ? orders : [];
  const safeMenuItems = Array.isArray(menuItems) ? menuItems : [];
  const safeCategories = Array.isArray(categories) ? categories : [];

  const restaurantId = restaurant?.id;
  const ordersForRestaurant = safeOrders.filter(o => o.restaurantId === restaurantId);
  const menuItemsForRestaurant = safeMenuItems.filter(d => d.restaurantId === restaurantId);
  const categoriesForRestaurant = safeCategories.filter(c => c.restaurantId === restaurantId);
  
  // Visitor tracking state
  const [visitorStats, setVisitorStats] = useState<VisitorStats | null>(null);
  
  // Separate orders by status
  const pendingOrders = ordersForRestaurant.filter(o => o.status === 'pending');
  const nonPendingOrders = ordersForRestaurant.filter(o => o.status !== 'pending');
  
  // Calculate stats
  const totalRevenue = useMemo(() => nonPendingOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0), [nonPendingOrders]);
  const totalOrders = useMemo(() => nonPendingOrders.length, [nonPendingOrders]);
  const totalDishes = menuItemsForRestaurant.length;
  
  // Calculate categories and subcategories
  const mainCategories = categoriesForRestaurant.filter(c => !c.parentCategoryId);
  const subCategories = categoriesForRestaurant.filter(c => c.parentCategoryId);
  const totalCategories = mainCategories.length;
  const totalSubCategories = subCategories.length;

  // Recent Orders (latest 4)
  const recentOrders = useMemo(() => {
    return ordersForRestaurant.slice().sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)).slice(0, 4);
  }, [ordersForRestaurant]);

  // Top Performing Dishes (by order count)
  const topDishes = useMemo(() => {
    const dishMap: Record<string, { title: string; count: number; revenue: number }> = {};
    ordersForRestaurant.forEach(order => {
      (order.items || []).forEach((item: any) => {
        if (!dishMap[item.menuItemId]) {
          const menuItem = menuItemsForRestaurant.find((m: any) => m.id === item.menuItemId);
          dishMap[item.menuItemId] = {
            title: menuItem?.title || item.title || t('unknown', language),
            count: 0,
            revenue: 0,
          };
        }
        dishMap[item.menuItemId].count += item.quantity || 1;
        dishMap[item.menuItemId].revenue += (item.price || 0) * (item.quantity || 1);
      });
    });
    return Object.values(dishMap).sort((a, b) => b.count - a.count).slice(0, 4);
  }, [ordersForRestaurant, menuItemsForRestaurant]);

  // Feature toggles from restaurant
  const {
    publicMenuLink = true,
    publicOrderLink = true,
    orderManagement = true,
  } = restaurant || {};

  const { language } = useLanguage();
  
  // Subscribe to visitor statistics
  useEffect(() => {
    if (!restaurantId) return;
    
    const unsubscribe = subscribeToVisitorStats(
      restaurantId,
      isDemoUser,
      isDemoUser ? restaurantId : undefined,
      (stats) => {
        setVisitorStats(stats);
      }
    );
    
    return unsubscribe;
  }, [restaurantId, isDemoUser]);

  // Determine currency symbol
  const currencyCode = restaurant?.currency || 'XAF';
  const currencySymbol = getCurrencySymbol(currencyCode) || 'FCFA';

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size={60} />
      </div>
    );
  }

  return (
    <div className="pb-8">
      {/* Links Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Public Menu Link Card */}
        {publicMenuLink && (
          <div className="flex flex-col bg-white rounded-lg shadow p-4 transition-transform hover:shadow-lg hover:scale-[1.02]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <ClipboardList className="h-5 w-5 mr-2" style={{ color: designSystem.colors.primary }} />
                <span className="font-semibold text-base" style={{ color: designSystem.colors.primary }}>{t('public_menu_link', language)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-yellow-100 text-yellow-900 border border-yellow-300" title={`${visitorStats?.menuVisits || 0} visitors`}
                >
                  <Eye className="h-3 w-3" />
                  <span>{visitorStats?.menuVisits || 0}</span>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                className="w-full px-2 py-1 border rounded bg-gray-100 text-gray-700 text-xs sm:text-sm"
                value={`${window.location.origin}/public-menu/${restaurant.id}`}
                readOnly
                id="public-menu-link"
              />
              <button
                className="inline-flex items-center justify-center rounded-md p-2 transition hover:opacity-90"
                style={{ background: designSystem.colors.secondary }}
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/public-menu/${restaurant.id}`);
                  toast.success(t('menu_link_copied', language), {
                    style: {
                      background: designSystem.colors.success,
                      color: designSystem.colors.textInverse,
                    },
                  });
                }}
                title={t('copy_link', language)}
              >
                <Copy color={designSystem.colors.primary} size={16} />
              </button>
              <button
                className="inline-flex items-center px-2 py-1 rounded bg-[${designSystem.colors.secondary}] text-black hover:opacity-90 text-xs"
                onClick={() => window.open(`${window.location.origin}/public-menu/${restaurant.id}`, '_blank')}
                title={t('open_link', language)}
              >
                <span className="sr-only">{t('open', language)}</span>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M14 3h7m0 0v7m0-7L10 14m-7 7h7a2 2 0 002-2v-7" /></svg>
              </button>
            </div>
          </div>
        )}
        {/* Public Order Link Card */}
        {publicOrderLink && (
          <div className="flex flex-col bg-white rounded-lg shadow p-4 transition-transform hover:shadow-lg hover:scale-[1.02]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <ClipboardList className="h-5 w-5 mr-2" style={{ color: designSystem.colors.primary }} />
                <span className="font-semibold text-base" style={{ color: designSystem.colors.primary }}>{t('public_order_link', language)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-yellow-100 text-yellow-900 border border-yellow-300" title={`${visitorStats?.orderVisits || 0} visitors`}
                >
                  <Eye className="h-3 w-3" />
                  <span>{visitorStats?.orderVisits || 0}</span>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                className="w-full px-2 py-1 border rounded bg-gray-100 text-gray-700 text-xs sm:text-sm"
                value={`${window.location.origin}/public-order/${restaurant.id}`}
                readOnly
                id="public-order-link"
              />
              <button
                className="inline-flex items-center justify-center rounded-md p-2 transition hover:opacity-90"
                style={{ background: designSystem.colors.secondary }}
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/public-order/${restaurant.id}`);
                  toast.success(t('order_link_copied', language), {
                    style: {
                      background: designSystem.colors.success,
                      color: designSystem.colors.textInverse,
                    },
                  });
                }}
                title={t('copy_link', language)}
              >
                <Copy color={designSystem.colors.primary} size={16} />
              </button>
              <button
                className="inline-flex items-center px-2 py-1 rounded bg-[${designSystem.colors.secondary}] text-black hover:opacity-90 text-xs"
                onClick={() => window.open(`${window.location.origin}/public-order/${restaurant.id}`, '_blank')}
                title={t('open_link', language)}
              >
                <span className="sr-only">{t('open', language)}</span>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M14 3h7m0 0v7m0-7L10 14m-7 7h7a2 2 0 002-2v-7" /></svg>
              </button>
            </div>
          </div>
        )}
        {/* Delivery Menu Link Card */}
        {restaurant?.publicDailyMenuLink && (
          <div className="flex flex-col bg-white rounded-lg shadow p-4 transition-transform hover:shadow-lg hover:scale-[1.02]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <Truck className="h-5 w-5 mr-2" style={{ color: designSystem.colors.primary }} />
                <span className="font-semibold text-base" style={{ color: designSystem.colors.primary }}>{t('delivery_menu', language)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-yellow-100 text-yellow-900 border border-yellow-300" title={`${visitorStats?.dailyMenuVisits || 0} visitors`}
                >
                  <Eye className="h-3 w-3" />
                  <span>{visitorStats?.dailyMenuVisits || 0}</span>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                className="w-full px-2 py-1 border rounded bg-gray-100 text-gray-700 text-xs sm:text-sm"
                value={`${window.location.origin}/public-daily-menu/${restaurant.id}`}
                readOnly
                id="delivery-menu-link"
              />
              <button
                className="inline-flex items-center justify-center rounded-md p-2 transition hover:opacity-90"
                style={{ background: designSystem.colors.secondary }}
                onClick={() => {
                  const link = `${window.location.origin}/public-daily-menu/${restaurant.id}`;
                  navigator.clipboard.writeText(link);
                  toast.success(t('delivery_link_copied', language), {
                    style: {
                      background: designSystem.colors.success,
                      color: designSystem.colors.textInverse,
                    },
                  });
                }}
                title={t('copy_delivery_link', language)}
              >
                <Copy color={designSystem.colors.primary} size={16} />
              </button>
              <button
                className="inline-flex items-center px-2 py-1 rounded bg-[${designSystem.colors.secondary}] text-black hover:opacity-90 text-xs"
                              onClick={() => {
                const link = `${window.location.origin}/public-daily-menu/${restaurant.id}`;
                window.open(link, '_blank');
              }}
                title={t('open_delivery_link', language)}
              >
                <span className="sr-only">Open</span>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M14 3h7m0 0v7m0-7L10 14m-7 7h7a2 2 0 002-2v-7" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5 mb-6">
        {/* Stat Card: Revenue (only if orderManagement enabled) */}
        {orderManagement && (
          <div className="bg-white shadow rounded-lg p-5 flex flex-col gap-2 transition-transform hover:shadow-xl hover:scale-[1.03]">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center rounded-md" style={{ background: designSystem.colors.secondary, width: 40, height: 40 }}>
                <ShoppingCart className="h-6 w-6" style={{ color: designSystem.colors.primary }} />
              </div>
              <div>
                <div className="text-xs" style={{ color: designSystem.colors.text }}>{t('total_revenue', language)}</div>
                <div className="text-xl font-bold" style={{ color: designSystem.colors.primary }}>{totalRevenue.toLocaleString()} {currencySymbol}</div>
                <div className="text-xs text-gray-400 mt-1">{t('excluding_pending_orders', language)}</div>
              </div>
            </div>
          </div>
        )}
        {/* Stat Card: Orders (only if orderManagement enabled) */}
        {orderManagement && (
          <div className="bg-white shadow rounded-lg p-5 flex flex-col gap-2 transition-transform hover:shadow-xl hover:scale-[1.03]">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center rounded-md" style={{ background: designSystem.colors.secondary, width: 40, height: 40 }}>
                <ClipboardList className="h-6 w-6" style={{ color: designSystem.colors.primary }} />
              </div>
              <div>
                <div className="text-xs" style={{ color: designSystem.colors.text }}>{t('total_orders', language)}</div>
                <div className="text-xl font-bold" style={{ color: designSystem.colors.primary }}>{totalOrders}</div>
                <div className="text-xs text-gray-400 mt-1">{t('excluding_pending_orders', language)}</div>
                <div className="text-xs text-orange-600 mt-1">{pendingOrders.length} {t('pending', language)}</div>
              </div>
            </div>
          </div>
        )}
        {/* Stat Card: Dishes (always) */}
        <div className="bg-white shadow rounded-lg p-5 flex flex-col gap-2 transition-transform hover:shadow-xl hover:scale-[1.03]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-md" style={{ background: designSystem.colors.secondary, width: 40, height: 40 }}>
              <UtensilsCrossed className="h-6 w-6" style={{ color: designSystem.colors.primary }} />
            </div>
            <div>
              <div className="text-xs" style={{ color: designSystem.colors.text }}>{t('total_dishes', language)}</div>
              <div className="text-xl font-bold" style={{ color: designSystem.colors.primary }}>{totalDishes}</div>
              <div className="text-xs text-gray-400 mt-1">{t('active_dishes_only', language)}</div>
            </div>
          </div>
        </div>
        {/* Stat Card: Categories (always) */}
        <div className="bg-white shadow rounded-lg p-5 flex flex-col gap-2 transition-transform hover:shadow-xl hover:scale-[1.03]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-md" style={{ background: designSystem.colors.secondary, width: 40, height: 40 }}>
              <Layers className="h-6 w-6" style={{ color: designSystem.colors.primary }} />
            </div>
            <div>
              <div className="text-xs" style={{ color: designSystem.colors.text }}>{t('total_categories', language)}</div>
              <div className="text-xl font-bold" style={{ color: designSystem.colors.primary }}>{totalCategories}</div>
              <div className="text-xs text-gray-400 mt-1">{totalSubCategories} {t('subcategories', language)}</div>
            </div>
          </div>
        </div>
        
        {/* Stat Card: Total Visitors */}
        <div className="bg-white shadow rounded-lg p-5 flex flex-col gap-2 transition-transform hover:shadow-xl hover:scale-[1.03]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-md" style={{ background: designSystem.colors.secondary, width: 40, height: 40 }}>
              <Eye className="h-6 w-6" style={{ color: designSystem.colors.primary }} />
            </div>
            <div>
              <div className="text-xs" style={{ color: designSystem.colors.text }}>{t('total_visitors', language) || 'Total Visitors'}</div>
              <div className="text-xl font-bold" style={{ color: designSystem.colors.primary }}>
                {visitorStats?.totalVisitors || 0}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {visitorStats?.visitsToday || 0} {t('today', language) || 'today'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Recent Orders (only if orderManagement enabled) */}
        {orderManagement && (
          <div className="bg-white shadow rounded-lg p-5">
            <div className="flex items-center mb-3">
              <ClipboardList className="h-5 w-5 mr-2" style={{ color: designSystem.colors.primary }} />
              <span className="font-semibold text-lg" style={{ color: designSystem.colors.primary }}>{t('recent_orders', language)}</span>
            </div>
            <div className="divide-y divide-gray-100">
              {recentOrders.length === 0 && <div className="text-gray-400 text-sm py-4">{t('no_recent_orders', language)}</div>}
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between py-3">
                  <div className="flex flex-col">
                    <span className="font-mono text-xs text-gray-500">#{order.id?.slice(-4) || '----'}</span>
                    <span className="text-sm font-medium text-gray-800">
                      {order.customerName || t('customer', language)}
                      {order.customerPhone ? ` (${order.customerPhone})` : ''}
                    </span>
                    <span className="text-xs text-gray-400">{order.items?.length || 0} {t('items', language)} • {order.createdAt?.toDate ? timeAgo(order.createdAt.toDate()) : ''}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    {(() => {
                      const statusColors = getOrderStatusColors(order.status);
                      return (
                        <span
                          className="px-2 py-1 rounded text-xs font-semibold"
                          style={{ background: statusColors.background, color: statusColors.color }}
                        >
                          {t(order.status, language)}
                        </span>
                      );
                    })()}
                    <span className="text-sm font-bold mt-1" style={{ color: designSystem.colors.primary }}>
                      {order.totalAmount?.toLocaleString()} {currencySymbol}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Top Performing Dishes (only if orderManagement enabled) */}
        {orderManagement && (
          <div className="bg-white shadow rounded-lg p-5">
            <div className="flex items-center mb-3">
              <BarChart2 className="h-5 w-5 mr-2" style={{ color: designSystem.colors.primary }} />
              <span className="font-semibold text-lg" style={{ color: designSystem.colors.primary }}>{t('top_performing_dishes', language)}</span>
            </div>
            <div className="divide-y divide-gray-100">
              {topDishes.length === 0 && <div className="text-gray-400 text-sm py-4">{t('no_data', language)}</div>}
              {topDishes.map((dish, idx) => (
                <div key={dish.title} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full font-bold" style={{ background: designSystem.colors.secondary, color: designSystem.colors.primary }}>{idx + 1}</span>
                    <span className="text-sm font-medium text-gray-800">{dish.title}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-gray-500">{dish.count} {t('orders', language)}</span>
                    <span className="text-sm font-bold mt-1" style={{ color: designSystem.colors.primary }}>
                      {dish.revenue.toLocaleString()} {currencySymbol}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
        <div className="bg-white shadow rounded-lg flex flex-col items-center justify-center py-6 cursor-pointer transition-transform hover:shadow-xl hover:scale-[1.03]">
          <UtensilsCrossed className="h-7 w-7 mb-2" style={{ color: designSystem.colors.secondary }} />
          <span className="font-semibold text-sm" style={{ color: designSystem.colors.primary }}>{t('add_new_dish', language)}</span>
        </div>
        {orderManagement && (
          <div className="bg-white shadow rounded-lg flex flex-col items-center justify-center py-6 cursor-pointer transition-transform hover:shadow-xl hover:scale-[1.03]">
            <ClipboardList className="h-7 w-7 mb-2" style={{ color: designSystem.colors.secondary }} />
            <span className="font-semibold text-sm" style={{ color: designSystem.colors.primary }}>{t('view_orders', language)}</span>
          </div>
        )}
        <div className="bg-white shadow rounded-lg flex flex-col items-center justify-center py-6 cursor-pointer transition-transform hover:shadow-xl hover:scale-[1.03]">
          <User className="h-7 w-7 mb-2" style={{ color: designSystem.colors.secondary }} />
          <span className="font-semibold text-sm" style={{ color: designSystem.colors.primary }}>{t('customer_reviews', language)}</span>
        </div>
        <div className="bg-white shadow rounded-lg flex flex-col items-center justify-center py-6 cursor-pointer transition-transform hover:shadow-xl hover:scale-[1.03]">
          <BarChart2 className="h-7 w-7 mb-2" style={{ color: designSystem.colors.secondary }} />
          <span className="font-semibold text-sm" style={{ color: designSystem.colors.primary }}>{t('view_analytics', language)}</span>
        </div>
      </div>

      {children}
    </div>
  );
};

function timeAgo(date: Date) {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default DashboardContent;