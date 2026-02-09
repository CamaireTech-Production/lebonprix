import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Search, Download } from 'lucide-react';
import { Card, Input } from '@components/common';
import { formatPrice } from '@utils/formatting/formatPrice';
import { useCurrency } from '@hooks/useCurrency';

interface ProductSoldData {
  id: string;
  name: string;
  quantity: number;
  customersCount: number;
  salesCount: number;
  totalSales: number;
  profitMargin: number;
  grossProfit: number;
}

interface AllProductsSoldProps {
  productsData: ProductSoldData[];
}

type SortField = 'name' | 'quantity' | 'customersCount' | 'salesCount' | 'totalSales' | 'profitMargin';
type SortDirection = 'asc' | 'desc';

const AllProductsSold = ({ productsData }: AllProductsSoldProps) => {
  const { t } = useTranslation();
  const { format: formatCurrency } = useCurrency();

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [showAll, setShowAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('quantity');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Filter products by search query
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return productsData;

    const query = searchQuery.toLowerCase().trim();
    return productsData.filter(product =>
      product.name.toLowerCase().includes(query)
    );
  }, [productsData, searchQuery]);

  // Sort filtered products
  const sortedProducts = useMemo(() => {
    const sorted = [...filteredProducts];

    sorted.sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'quantity':
          aValue = a.quantity;
          bValue = b.quantity;
          break;
        case 'customersCount':
          aValue = a.customersCount;
          bValue = b.customersCount;
          break;
        case 'salesCount':
          aValue = a.salesCount;
          bValue = b.salesCount;
          break;
        case 'totalSales':
          aValue = a.totalSales;
          bValue = b.totalSales;
          break;
        case 'profitMargin':
          aValue = a.profitMargin;
          bValue = b.profitMargin;
          break;
        default:
          aValue = a.quantity;
          bValue = b.quantity;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === 'asc'
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });

    return sorted;
  }, [filteredProducts, sortField, sortDirection]);

  // Pagination
  const effectiveItemsPerPage = showAll ? sortedProducts.length : itemsPerPage;
  const totalPages = showAll ? 1 : Math.ceil(sortedProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * effectiveItemsPerPage;
  const endIndex = startIndex + effectiveItemsPerPage;
  const paginatedProducts = sortedProducts.slice(startIndex, endIndex);

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  // Handle items per page change
  const handleItemsPerPageChange = (value: string) => {
    if (value === 'all') {
      setShowAll(true);
      setCurrentPage(1);
    } else {
      setShowAll(false);
      setItemsPerPage(Number(value));
      setCurrentPage(1); // Reset to first page
    }
  };

  // Export to CSV
  const handleExport = () => {
    const escapeCSV = (field: string | number): string => {
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const header = [
      t('reports.tables.allProductsSold.product'),
      t('reports.tables.allProductsSold.quantity'),
      t('reports.tables.allProductsSold.salesCount'),
      t('reports.tables.allProductsSold.customers'),
      t('reports.tables.allProductsSold.sales'),
      t('reports.tables.allProductsSold.profit'),
      t('reports.tables.allProductsSold.margin')
    ];

    const rows = sortedProducts.map(p => [
      p.name,
      p.quantity,
      p.salesCount,
      p.customersCount,
      formatCurrency(p.totalSales),
      formatCurrency(p.grossProfit),
      `${p.profitMargin.toFixed(1)}%`
    ]);

    const csv = [header, ...rows].map(r => r.map(escapeCSV).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all-products-sold-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 7;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  // Summary statistics
  const totalQuantity = useMemo(() =>
    sortedProducts.reduce((sum, p) => sum + p.quantity, 0),
    [sortedProducts]
  );

  const totalRevenue = useMemo(() =>
    sortedProducts.reduce((sum, p) => sum + p.totalSales, 0),
    [sortedProducts]
  );

  const totalProfit = useMemo(() =>
    sortedProducts.reduce((sum, p) => sum + p.grossProfit, 0),
    [sortedProducts]
  );

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="text-gray-400 text-xs ml-1">⇅</span>;
    }
    return (
      <span className="text-indigo-600 text-xs ml-1">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  return (
    <Card
      title={
        <div className="flex items-center justify-between w-full">
          <span>{t('reports.tables.allProductsSold.title')} ({sortedProducts.length})</span>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            <Download size={16} />
            {t('reports.tables.allProductsSold.export')}
          </button>
        </div>
      }
      className="mb-6"
    >
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
        <div className="text-center">
          <p className="text-sm text-gray-600">{t('reports.tables.allProductsSold.totalQuantity')}</p>
          <p className="text-2xl font-semibold text-gray-900">{totalQuantity.toLocaleString()}</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-600">{t('reports.tables.allProductsSold.totalRevenue')}</p>
          <p className="text-2xl font-semibold text-emerald-600">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-600">{t('reports.tables.allProductsSold.totalProfit')}</p>
          <p className="text-2xl font-semibold text-indigo-600">{formatCurrency(totalProfit)}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <Input
              type="text"
              placeholder={t('reports.tables.allProductsSold.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1); // Reset to first page on search
              }}
              className="pl-10"
            />
          </div>
        </div>

        {/* Sort by */}
        <div className="w-full md:w-48">
          <select
            className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
          >
            <option value="quantity">{t('reports.tables.allProductsSold.sortByQuantity')}</option>
            <option value="salesCount">{t('reports.tables.allProductsSold.sortBySalesCount')}</option>
            <option value="totalSales">{t('reports.tables.allProductsSold.sortBySales')}</option>
            <option value="profitMargin">{t('reports.tables.allProductsSold.sortByMargin')}</option>
            <option value="customersCount">{t('reports.tables.allProductsSold.sortByCustomers')}</option>
            <option value="name">{t('reports.tables.allProductsSold.sortByName')}</option>
          </select>
        </div>

        {/* Items per page */}
        <div className="w-full md:w-40">
          <select
            className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            value={showAll ? 'all' : itemsPerPage}
            onChange={(e) => handleItemsPerPageChange(e.target.value)}
          >
            <option value={10}>10 {t('reports.tables.allProductsSold.perPage')}</option>
            <option value={25}>25 {t('reports.tables.allProductsSold.perPage')}</option>
            <option value={50}>50 {t('reports.tables.allProductsSold.perPage')}</option>
            <option value={100}>100 {t('reports.tables.allProductsSold.perPage')}</option>
            <option value="all">{t('reports.tables.allProductsSold.showAll')}</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center">
                  {t('reports.tables.allProductsSold.product')}
                  <SortIcon field="name" />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('quantity')}
              >
                <div className="flex items-center">
                  {t('reports.tables.allProductsSold.quantity')}
                  <SortIcon field="quantity" />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('salesCount')}
              >
                <div className="flex items-center">
                  {t('reports.tables.allProductsSold.salesCount')}
                  <SortIcon field="salesCount" />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('customersCount')}
              >
                <div className="flex items-center">
                  {t('reports.tables.allProductsSold.customers')}
                  <SortIcon field="customersCount" />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('totalSales')}
              >
                <div className="flex items-center">
                  {t('reports.tables.allProductsSold.sales')}
                  <SortIcon field="totalSales" />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('profitMargin')}
              >
                <div className="flex items-center">
                  {t('reports.tables.allProductsSold.profit')}
                  <SortIcon field="profitMargin" />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {t('reports.tables.allProductsSold.margin')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedProducts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                  {searchQuery
                    ? t('reports.tables.allProductsSold.noResults')
                    : t('reports.tables.allProductsSold.noData')
                  }
                </td>
              </tr>
            ) : (
              paginatedProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {product.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {product.quantity.toLocaleString()} {t('reports.tables.allProductsSold.units')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {product.salesCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {product.customersCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatCurrency(product.totalSales)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-emerald-600">
                    {formatCurrency(product.grossProfit)}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${product.profitMargin >= 20 ? 'text-emerald-600' :
                      product.profitMargin >= 10 ? 'text-amber-600' :
                        'text-red-600'
                    }`}>
                    {product.profitMargin.toFixed(1)}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Show All message or Pagination */}
      {showAll ? (
        <div className="mt-4 text-sm text-gray-700 text-center">
          {t('reports.tables.allProductsSold.showing')} {sortedProducts.length} {t('reports.tables.allProductsSold.of')} {sortedProducts.length}
        </div>
      ) : totalPages > 1 && (
        <div className="mt-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-700">
            {t('reports.tables.allProductsSold.showing')} {startIndex + 1}-{Math.min(endIndex, sortedProducts.length)} {t('reports.tables.allProductsSold.of')} {sortedProducts.length}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="flex gap-1">
              {getPageNumbers().map((page, index) => (
                page === '...' ? (
                  <span key={`ellipsis-${index}`} className="px-3 py-2 text-gray-500">
                    ...
                  </span>
                ) : (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page as number)}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${currentPage === page
                        ? 'bg-indigo-600 text-white'
                        : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                  >
                    {page}
                  </button>
                )
              ))}
            </div>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </Card>
  );
};

export default AllProductsSold;
