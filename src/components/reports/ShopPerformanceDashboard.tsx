/**
 * Shop Performance Dashboard Component
 * Displays key performance metrics for shops
 */

import React, { useMemo } from 'react';
import { Store, TrendingUp, DollarSign, Package, Users } from 'lucide-react';
import type { Sale, Shop } from '../../types/models';
import { formatPrice } from '@utils/formatting/formatPrice';

interface ShopPerformanceDashboardProps {
  shops: Shop[];
  sales: Sale[];
  dateRange?: { from: Date; to: Date };
}

interface ShopPerformance {
  shopId: string;
  shopName: string;
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
  salesCount: number;
  averageOrderValue: number;
  profitMargin: number;
}

export const ShopPerformanceDashboard: React.FC<ShopPerformanceDashboardProps> = ({
  shops,
  sales,
  dateRange
}) => {
  // Calculate shop performance metrics
  const shopPerformance = useMemo(() => {
    const performanceMap = new Map<string, ShopPerformance>();

    // Initialize all shops
    shops.forEach(shop => {
      performanceMap.set(shop.id, {
        shopId: shop.id,
        shopName: shop.name,
        totalSales: 0,
        totalRevenue: 0,
        totalProfit: 0,
        salesCount: 0,
        averageOrderValue: 0,
        profitMargin: 0
      });
    });

    // Filter sales by date range if provided
    let filteredSales = sales.filter(s => s.isAvailable !== false);
    if (dateRange) {
      filteredSales = filteredSales.filter(sale => {
        if (!sale.createdAt) return false;
        const saleDate = new Date(sale.createdAt.seconds * 1000);
        return saleDate >= dateRange.from && saleDate <= dateRange.to;
      });
    }

    // Calculate metrics for each shop
    filteredSales.forEach(sale => {
      if (sale.sourceType === 'shop' && sale.shopId) {
        const performance = performanceMap.get(sale.shopId);
        if (performance) {
          performance.salesCount += 1;
          performance.totalRevenue += sale.totalAmount || 0;
          performance.totalProfit += sale.totalProfit || 0;
        }
      }
    });

    // Calculate derived metrics
    performanceMap.forEach(performance => {
      performance.totalSales = performance.salesCount;
      performance.averageOrderValue = performance.salesCount > 0
        ? performance.totalRevenue / performance.salesCount
        : 0;
      performance.profitMargin = performance.totalRevenue > 0
        ? (performance.totalProfit / performance.totalRevenue) * 100
        : 0;
    });

    return Array.from(performanceMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [shops, sales, dateRange]);

  // Calculate totals
  const totals = useMemo(() => {
    return shopPerformance.reduce((acc, shop) => ({
      totalRevenue: acc.totalRevenue + shop.totalRevenue,
      totalProfit: acc.totalProfit + shop.totalProfit,
      totalSales: acc.totalSales + shop.salesCount
    }), { totalRevenue: 0, totalProfit: 0, totalSales: 0 });
  }, [shopPerformance]);

  if (shops.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
        <Store className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p>Aucune boutique disponible</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Revenu Total</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatPrice(totals.totalRevenue)}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-emerald-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Bénéfice Total</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatPrice(totals.totalProfit)}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ventes Total</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {totals.totalSales}
              </p>
            </div>
            <Package className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Shop Performance Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Performance par Boutique</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Boutique
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ventes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenu
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bénéfice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Panier Moyen
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Marge (%)
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {shopPerformance.map((shop) => (
                <tr key={shop.shopId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Store className="w-5 h-5 text-gray-400 mr-2" />
                      <span className="text-sm font-medium text-gray-900">{shop.shopName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {shop.salesCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatPrice(shop.totalRevenue)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatPrice(shop.totalProfit)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatPrice(shop.averageOrderValue)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`font-medium ${
                      shop.profitMargin >= 20 ? 'text-emerald-600' :
                      shop.profitMargin >= 10 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {shop.profitMargin.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ShopPerformanceDashboard;

