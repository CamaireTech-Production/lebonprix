import { useState, useMemo } from 'react';
import { Search, RefreshCcw, AlertTriangle, ChevronDown, ChevronUp, Package } from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Badge from '../../components/common/Badge';
import { useMatiereStocks } from '../../hooks/useMatiereStocks';
import { useCategories } from '../../hooks/useFirestore';
import { showSuccessToast, showErrorToast } from '../../utils/toast';
import LoadingScreen from '../../components/common/LoadingScreen';
import { ImageWithSkeleton } from '../../components/common/ImageWithSkeleton';
import { useMatieres } from '../../hooks/useMatieres';

const Stocks = () => {
  const { matiereStocks, loading, error } = useMatiereStocks();
  const { matieres } = useMatieres();
  const { categories } = useCategories();
  const [search, setSearch] = useState('');
  const [expandedMatiereId, setExpandedMatiereId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Filter matiere stocks
  const filteredMatiereStocks = useMemo(() => {
    let filtered = matiereStocks;

    // Filter by search
    if (search.trim()) {
      const query = search.toLowerCase();
      filtered = filtered.filter(ms =>
        ms.matiereName.toLowerCase().includes(query) ||
        ms.category.toLowerCase().includes(query)
      );
    }

    // Filter by category
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(ms => ms.category === selectedCategory);
    }

    return filtered;
  }, [matiereStocks, search, selectedCategory]);

  // Get unique categories
  const availableCategories = useMemo(() => {
    const cats = ['All', ...new Set(matiereStocks.map(ms => ms.category).filter(Boolean))];
    return cats;
  }, [matiereStocks]);

  const handleExpand = (matiereId: string) => {
    setExpandedMatiereId(prev => (prev === matiereId ? null : matiereId));
  };

  const getCategoryName = (categoryName: string) => {
    const category = categories.find(c => c.name === categoryName);
    return category?.name || categoryName;
  };

  const getMatiere = (matiereId: string) => {
    return matieres.find(m => m.id === matiereId);
  };

  // Check for low stock (threshold: 10 units)
  const lowStockThreshold = 10;
  const lowStockMatieres = filteredMatiereStocks.filter(ms => ms.currentStock <= lowStockThreshold);

  if (loading && matiereStocks.length === 0) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <Card>
        <div className="text-center py-12 text-red-600">
          <p>Erreur lors du chargement des stocks: {error}</p>
        </div>
      </Card>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Stocks des matières</h2>
          <p className="text-gray-600">Gérer les stocks de vos matières premières</p>
        </div>
        <Button variant="outline" icon={<RefreshCcw size={16} />}>
          Actualiser
        </Button>
      </div>

      {/* Low Stock Alert */}
      {lowStockMatieres.length > 0 && (
        <Card className="mb-6 bg-yellow-50 border-yellow-200">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="text-yellow-600" size={20} />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-800">
                {lowStockMatieres.length} matière{lowStockMatieres.length > 1 ? 's' : ''} en stock faible
              </p>
              <p className="text-xs text-yellow-600 mt-1">
                Stock inférieur ou égal à {lowStockThreshold} unités
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <Input
            placeholder="Rechercher une matière..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="sm:w-48">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            {availableCategories.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'All' ? 'Toutes les catégories' : cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Matiere Stocks List */}
      {filteredMatiereStocks.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <Package className="text-gray-400" size={32} />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {search || selectedCategory !== 'All' ? 'Aucune matière trouvée' : 'Aucune matière'}
            </h3>
            <p className="text-gray-500">
              {search || selectedCategory !== 'All'
                ? 'Essayez de modifier vos critères de recherche'
                : 'Ajoutez des matières pour voir leurs stocks ici'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredMatiereStocks.map(ms => {
            const matiere = getMatiere(ms.matiereId);
            const isExpanded = expandedMatiereId === ms.matiereId;
            const isLowStock = ms.currentStock <= lowStockThreshold;

            return (
              <Card key={ms.matiereId} className={isLowStock ? 'border-yellow-300 bg-yellow-50' : ''}>
                <div className="flex items-start space-x-4">
                  {/* Matiere Image */}
                  {matiere && matiere.images && matiere.images.length > 0 && (
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      <ImageWithSkeleton
                        src={matiere.images[0]}
                        alt={matiere.name}
                        className="w-full h-full object-cover"
                        placeholder="/placeholder.png"
                      />
                    </div>
                  )}

                  {/* Matiere Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {ms.matiereName}
                        </h3>
                        <div className="flex flex-wrap gap-2 mb-2">
                          <Badge variant="info">
                            {getCategoryName(ms.category)}
                          </Badge>
                          <Badge variant={isLowStock ? 'warning' : 'success'}>
                            Stock: {ms.currentStock.toLocaleString()} {ms.unit}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600">
                          Prix d'achat: {ms.costPrice.toLocaleString()} XAF / {ms.unit}
                        </div>
                      </div>

                      {/* Expand Button */}
                      <button
                        onClick={() => handleExpand(ms.matiereId)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </button>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="space-y-3">
                          {/* Batches */}
                          {ms.batches.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-700 mb-2">
                                Lots ({ms.batches.length})
                              </h4>
                              <div className="space-y-2">
                                {ms.batches.map(batch => (
                                  <div key={batch.id} className="bg-gray-50 p-3 rounded-md text-sm">
                                    <div className="flex justify-between items-center">
                                      <div>
                                        <span className="font-medium">
                                          {batch.remainingQuantity} / {batch.quantity} {ms.unit}
                                        </span>
                                        <span className="text-gray-500 ml-2">
                                          @ {batch.costPrice.toLocaleString()} XAF
                                        </span>
                                      </div>
                                      <Badge variant={batch.status === 'active' ? 'success' : 'info'}>
                                        {batch.status}
                                      </Badge>
                                    </div>
                                    {batch.createdAt && (
                                      <div className="text-xs text-gray-500 mt-1">
                                        Créé le: {new Date(batch.createdAt.seconds * 1000).toLocaleDateString()}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Recent Stock Changes */}
                          {ms.stockChanges.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-700 mb-2">
                                Historique récent ({ms.stockChanges.slice(0, 5).length})
                              </h4>
                              <div className="space-y-1">
                                {ms.stockChanges.slice(0, 5).map(change => (
                                  <div key={change.id} className="text-sm text-gray-600 flex justify-between">
                                    <span>
                                      {change.reason === 'restock' && 'Réapprovisionnement'}
                                      {change.reason === 'adjustment' && 'Ajustement'}
                                      {change.reason === 'creation' && 'Création'}
                                      {change.reason === 'damage' && 'Dommage'}
                                      {change.reason === 'manual_adjustment' && 'Ajustement manuel'}
                                      {!['restock', 'adjustment', 'creation', 'damage', 'manual_adjustment'].includes(change.reason) && change.reason}
                                    </span>
                                    <span className={change.change > 0 ? 'text-green-600' : 'text-red-600'}>
                                      {change.change > 0 ? '+' : ''}{change.change} {ms.unit}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Stocks;

