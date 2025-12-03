import { useState, useMemo } from 'react';
import { useCustomerSources } from '../../hooks/useCustomerSources';
import { useCustomers } from '../../hooks/useFirestore';
import { useSales } from '../../hooks/useFirestore';
import Card from '../common/Card';
import Button from '../common/Button';
import Table from '../common/Table';
import LoadingScreen from '../common/LoadingScreen';
import { Plus, Edit2, Trash2, Power, PowerOff } from 'lucide-react';
import { showSuccessToast, showErrorToast, showWarningToast } from '../../utils/toast';
import CustomerSourceForm from './CustomerSourceForm';
import type { CustomerSource } from '../../types/models';
import Badge from '../common/Badge';

const CustomerSourceManager = () => {
  const { sources, loading, addSource, updateSource, deleteSource } = useCustomerSources();
  const { customers } = useCustomers();
  const { sales } = useSales();
  const [showForm, setShowForm] = useState(false);
  const [editingSource, setEditingSource] = useState<CustomerSource | null>(null);

  // Calculate statistics for each source
  const sourcesWithStats = useMemo(() => {
    return sources.map(source => {
      const customerCount = customers.filter(c => 
        c.customerSourceId === source.id || c.firstSourceId === source.id
      ).length;
      
      const saleCount = sales.filter(s => s.customerSourceId === source.id).length;
      
      const totalRevenue = sales
        .filter(s => s.customerSourceId === source.id)
        .reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
      
      return {
        ...source,
        customerCount,
        saleCount,
        totalRevenue
      };
    });
  }, [sources, customers, sales]);

  const handleCreateSource = async (sourceData: Omit<CustomerSource, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'companyId'>) => {
    try {
      await addSource(sourceData);
      setShowForm(false);
      showSuccessToast('Source créée avec succès');
    } catch (error) {
      showErrorToast('Erreur lors de la création de la source');
    }
  };

  const handleUpdateSource = async (sourceData: Omit<CustomerSource, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'companyId'>) => {
    if (!editingSource) return;
    
    try {
      await updateSource(editingSource.id, sourceData);
      setShowForm(false);
      setEditingSource(null);
      showSuccessToast('Source modifiée avec succès');
    } catch (error) {
      showErrorToast('Erreur lors de la modification de la source');
    }
  };

  const handleEditSource = (source: CustomerSource) => {
    setEditingSource(source);
    setShowForm(true);
  };

  const handleDeleteSource = async (sourceId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette source ? Cette action la désactivera.')) {
      return;
    }
    
    try {
      await deleteSource(sourceId);
      showSuccessToast('Source supprimée avec succès');
    } catch (error) {
      showErrorToast('Erreur lors de la suppression de la source');
    }
  };

  const handleToggleActive = async (source: CustomerSource) => {
    try {
      await updateSource(source.id, { isActive: !source.isActive });
      showSuccessToast(`Source ${source.isActive ? 'désactivée' : 'activée'} avec succès`);
    } catch (error) {
      showErrorToast('Erreur lors de la modification du statut');
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingSource(null);
  };

  if (loading) {
    return <LoadingScreen />;
  }

  const tableData = sourcesWithStats.map(source => ({
    id: source.id,
    name: (
      <div className="flex items-center gap-2">
        <div
          className="w-4 h-4 rounded-full"
          style={{ backgroundColor: source.color || '#3B82F6' }}
        />
        <span className="font-medium">{source.name}</span>
      </div>
    ),
    description: source.description || '-',
    status: (
      <Badge variant={source.isActive ? 'success' : 'info'}>
        {source.isActive ? 'Actif' : 'Inactif'}
      </Badge>
    ),
    customers: source.customerCount,
    sales: source.saleCount,
    revenue: new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0
    }).format(source.totalRevenue),
    actions: (
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleToggleActive(source)}
          className="text-gray-600 hover:text-gray-900"
          title={source.isActive ? 'Désactiver' : 'Activer'}
        >
          {source.isActive ? <PowerOff size={16} /> : <Power size={16} />}
        </button>
        <button
          onClick={() => handleEditSource(source)}
          className="text-indigo-600 hover:text-indigo-900"
          title="Modifier"
        >
          <Edit2 size={16} />
        </button>
        <button
          onClick={() => handleDeleteSource(source.id)}
          className="text-red-600 hover:text-red-900"
          title="Supprimer"
        >
          <Trash2 size={16} />
        </button>
      </div>
    )
  }));

  const tableColumns = [
    { header: 'Nom', accessor: 'name' as const },
    { header: 'Description', accessor: 'description' as const },
    { header: 'Statut', accessor: 'status' as const },
    { header: 'Clients', accessor: 'customers' as const },
    { header: 'Ventes', accessor: 'sales' as const },
    { header: 'CA Total', accessor: 'revenue' as const },
    { header: 'Actions', accessor: 'actions' as const }
  ];

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Sources Clientelles</h2>
          <p className="text-gray-600">Gérez les sources d'acquisition de vos clients</p>
        </div>
        <div className="mt-4 md:mt-0">
          <Button
            icon={<Plus size={16} />}
            onClick={() => {
              setEditingSource(null);
              setShowForm(true);
            }}
          >
            Créer une source
          </Button>
        </div>
      </div>

      <Card>
        {sourcesWithStats.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">Aucune source clientelle créée</p>
            <Button
              icon={<Plus size={16} />}
              onClick={() => {
                setEditingSource(null);
                setShowForm(true);
              }}
            >
              Créer votre première source
            </Button>
          </div>
        ) : (
          <Table
            data={tableData}
            columns={tableColumns}
            keyExtractor={(item) => item.id || ''}
            emptyMessage="Aucune source trouvée"
          />
        )}
      </Card>

      <CustomerSourceForm
        source={editingSource}
        isOpen={showForm}
        onClose={handleCloseForm}
        onSave={editingSource ? handleUpdateSource : handleCreateSource}
      />
    </div>
  );
};

export default CustomerSourceManager;






