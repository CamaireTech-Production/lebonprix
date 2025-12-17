import { useState, useEffect } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { Package, Grid3X3, Warehouse } from 'lucide-react';
import Matieres from './magasin/Matieres';
import Categories from './magasin/Categories';
import Stocks from './magasin/Stocks';

type Tab = 'matieres' | 'categories' | 'stocks';

const Magasin = () => {
  const { companyId } = useParams<{ companyId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>('matieres');

  // Initialize tab from URL or default to 'matieres'
  useEffect(() => {
    const tabParam = searchParams.get('tab') as Tab;
    if (tabParam && ['matieres', 'categories', 'stocks'].includes(tabParam)) {
      setActiveTab(tabParam);
    } else {
      // Set default tab in URL if not present
      setSearchParams({ tab: 'matieres' }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  };

  return (
    <div className="pb-16 md:pb-0">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Magasin</h1>
        <p className="text-gray-600">Gestion des matières premières, catégories et stocks</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => handleTabChange('matieres')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2
              ${activeTab === 'matieres'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            <Package size={18} />
            <span>Matières</span>
          </button>
          <button
            onClick={() => handleTabChange('categories')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2
              ${activeTab === 'categories'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            <Grid3X3 size={18} />
            <span>Catégories</span>
          </button>
          <button
            onClick={() => handleTabChange('stocks')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2
              ${activeTab === 'stocks'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            <Warehouse size={18} />
            <span>Stocks</span>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'matieres' && <Matieres />}
        {activeTab === 'categories' && <Categories />}
        {activeTab === 'stocks' && <Stocks />}
      </div>
    </div>
  );
};

export default Magasin;

