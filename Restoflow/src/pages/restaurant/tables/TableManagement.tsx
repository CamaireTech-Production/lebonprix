// Helper to queue admin actions offline
import { PendingAction } from '../../../types';
function queuePendingAction(action: PendingAction) {
  const arr: PendingAction[] = JSON.parse(localStorage.getItem('pendingActions') || '[]');
  arr.push({ ...action, timestamp: Date.now() });
  localStorage.setItem('pendingActions', JSON.stringify(arr));
}
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import { db } from '../../../firebase/config';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  orderBy 
} from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { 
  PlusCircle, 
  Edit, 
  Trash2, 
  Search, 
  X,
  Table as TableIcon,
  Save
} from 'lucide-react';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { Table } from '../../../types';
import designSystem from '../../../designSystem';
import { t } from '../../../utils/i18n';
import { useLanguage } from '../../../contexts/LanguageContext';

const TableManagement: React.FC = () => {
  const { restaurant } = useAuth();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [bulkMode, setBulkMode] = useState(false);
  const [tableCount, setTableCount] = useState(1);
  
  // Form state
  const [formData, setFormData] = useState({
    number: 1,
    name: '',
    status: 'available' as 'available' | 'occupied' | 'reserved'
  });

  const { language } = useLanguage();

  useEffect(() => {
    const fetchTables = async () => {
      if (!restaurant?.id) return;
      try {
        if (!navigator.onLine) {
          // Offline: load from localStorage
          const offlineTables = localStorage.getItem('offline_tables');
          setTables(offlineTables ? (JSON.parse(offlineTables) as Table[]).filter((t: Table) => t.restaurantId === restaurant.id) : []);
        } else {
          // Online: fetch from Firestore
          const tablesQuery = query(
            collection(db, 'tables'),
            where('restaurantId', '==', restaurant.id),
            orderBy('number')
          );
          const tablesSnapshot = await getDocs(tablesQuery);
          const tablesData = tablesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Table[];
          setTables(tablesData);
        }
      } catch (error) {
        console.error('Error fetching tables:', error);
        toast.error(t('failed_to_load_tables', language), {
          style: {
            background: designSystem.colors.error,
            color: designSystem.colors.text,
          },
        });
      } finally {
        setLoading(false);
      }
    };
    fetchTables();
  }, [restaurant, language]);

  const resetForm = () => {
    setFormData({
      number: tables.length > 0 ? Math.max(...tables.map(t => t.number)) + 1 : 1,
      name: '',
      status: 'available'
    });
    setEditingTable(null);
  };

  const openAddModal = () => {
    resetForm();
    setBulkMode(false);
    setIsModalOpen(true);
  };

  const openBulkAddModal = () => {
    resetForm();
    setBulkMode(true);
    setTableCount(1);
    setIsModalOpen(true);
  };

  const openEditModal = (table: Table) => {
    setEditingTable(table);
    setFormData({
      number: table.number,
      name: table.name || '',
      status: table.status
    });
    setBulkMode(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'number' ? parseInt(value) : value,
    });
  };

  const handleTableCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const count = parseInt(e.target.value);
    setTableCount(count > 0 ? count : 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!restaurant?.id) {
      toast.error(t('restaurant_info_missing', language), {
        style: {
          background: designSystem.colors.error,
          color: designSystem.colors.text,
        },
      });
      return;
    }
    
    if (formData.number <= 0) {
      toast.error(t('table_number_gt_zero', language), {
        style: {
          background: designSystem.colors.error,
          color: designSystem.colors.text,
        },
      });
      return;
    }
    
    setLoading(true);
    
    try {
      if (!navigator.onLine) {
        if (bulkMode) {
          for (let i = 0; i < tableCount; i++) {
            // Generate a robust unique ID for each offline table
            let uniqueId = '';
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
              uniqueId = `offline_${crypto.randomUUID()}`;
            } else {
              uniqueId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${i}`;
            }
            const tableData: Table = {
              number: formData.number + i,
              name: `Table ${formData.number + i}`,
              status: 'available',
              restaurantId: restaurant.id,
              id: uniqueId,
              createdAt: new Date(),
              updatedAt: undefined,
            };
            queuePendingAction({ type: 'createTable', payload: { ...tableData } });
            setTables(prevTables => [...prevTables, tableData]);
          }
          toast.success(t('tables_queued_for_sync', language) + ` ${tableCount}`, {
            style: {
              background: designSystem.colors.success,
              color: designSystem.colors.text,
            },
          });
        } else if (editingTable) {
          const tableData: Omit<Table, 'id' | 'createdAt' | 'updatedAt'> = {
            number: formData.number,
            name: formData.name.trim() || `Table ${formData.number}`,
            status: formData.status,
            restaurantId: restaurant.id,
          };
          queuePendingAction({ type: 'updateTable', payload: { id: editingTable.id, data: tableData } });
          setTables(prevTables => prevTables.map(table => table.id === editingTable.id ? { ...table, ...tableData, updatedAt: new Date() } : table));
          toast.success(t('table_update_queued', language), {
            style: {
              background: designSystem.colors.success,
              color: designSystem.colors.text,
            },
          });
        } else {
          const tableData: Table = {
            number: formData.number,
            name: formData.name.trim() || `Table ${formData.number}`,
            status: formData.status,
            restaurantId: restaurant.id,
            id: Date.now().toString(),
            createdAt: new Date(),
            updatedAt: undefined,
          };
          queuePendingAction({ type: 'createTable', payload: tableData });
          setTables(prevTables => [...prevTables, tableData]);
          toast.success(t('table_creation_queued', language), {
            style: {
              background: designSystem.colors.success,
              color: designSystem.colors.text,
            },
          });
        }
        closeModal();
        setLoading(false);
        return;
      }
      if (bulkMode) {
        // Add multiple tables
        const startingNumber = formData.number;
        const newTables: { createdAt: Date; number: number; name: string; status: "available"; restaurantId: string; id: string; }[] = [];
        for (let i = 0; i < tableCount; i++) {
          const tableData = {
            number: startingNumber + i,
            name: `Table ${startingNumber + i}`,
            status: 'available' as const,
            restaurantId: restaurant.id,
            createdAt: serverTimestamp(),
          };
          const docRef = await addDoc(collection(db, 'tables'), tableData);
          newTables.push({
            id: docRef.id,
            ...tableData,
            createdAt: new Date(),
          });
        }
        setTables(prevTables => [...prevTables, ...newTables]);
        toast.success(t('tables_added_success', language) + ` ${tableCount}`, {
          style: {
            background: designSystem.colors.success,
            color: designSystem.colors.text,
          },
        });
      } else if (editingTable) {
        // Update existing table
        const tableData = {
          number: formData.number,
          name: formData.name.trim() || `Table ${formData.number}`,
          status: formData.status,
          restaurantId: restaurant.id,
        };
        await updateDoc(doc(db, 'tables', editingTable.id), {
          ...tableData,
          updatedAt: serverTimestamp(),
        });
        setTables(prevTables => 
          prevTables.map(table => 
            table.id === editingTable.id 
              ? { ...table, ...tableData, updatedAt: new Date() } 
              : table
          )
        );
        toast.success(t('table_updated_success', language), {
          style: {
            background: designSystem.colors.success,
            color: designSystem.colors.text,
          },
        });
      } else {
        // Add single table
        const tableData = {
          number: formData.number,
          name: formData.name.trim() || `Table ${formData.number}`,
          status: formData.status,
          restaurantId: restaurant.id,
        };
        const docRef = await addDoc(collection(db, 'tables'), {
          ...tableData,
          createdAt: serverTimestamp(),
        });
        const newTable = {
          id: docRef.id,
          ...tableData,
          createdAt: new Date(),
        } as Table;
        setTables(prevTables => [...prevTables, newTable]);
        toast.success(t('table_added_success', language), {
          style: {
            background: designSystem.colors.success,
            color: designSystem.colors.text,
          },
        });
      }
      closeModal();
    } catch (error) {
      console.error('Error saving table:', error);
      toast.error(t('failed_to_save_table', language), {
        style: {
          background: designSystem.colors.error,
          color: designSystem.colors.text,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteTable = async (tableId: string) => {
    if (!restaurant?.id) return;
    
    try {
      setIsDeleting(true);
      if (!navigator.onLine) {
        queuePendingAction({ type: 'deleteTable', payload: { id: tableId } });
        setTables(prevTables => prevTables.filter(table => table.id !== tableId));
        toast.success(t('table_delete_queued', language), {
          style: {
            background: designSystem.colors.success,
            color: designSystem.colors.text,
          },
        });
        setIsDeleting(false);
        return;
      }
      await deleteDoc(doc(db, 'tables', tableId));
      setTables(prevTables => prevTables.filter(table => table.id !== tableId));
      toast.success(t('table_deleted_success', language), {
        style: {
          background: designSystem.colors.success,
          color: designSystem.colors.text,
        },
      });
    } catch (error) {
      console.error('Error deleting table:', error);
      toast.error(t('failed_to_delete_table', language), {
        style: {
          background: designSystem.colors.error,
          color: designSystem.colors.text,
        },
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter tables based on search query
  const filteredTables = tables.filter(table => 
    table.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    table.number.toString().includes(searchQuery)
  );

  if (loading && tables.length === 0) {
    return (
      <DashboardLayout title="">
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size={60} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="">
      <div className="shadow rounded-lg overflow-hidden" style={{ background: designSystem.colors.white }}>
        <div className="p-4 sm:p-6 border-b" style={{ borderColor: designSystem.colors.borderLightGray }}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-semibold" style={{ color: designSystem.colors.primary }}>{t('tables', language)}</h2>
              <p className="text-sm" style={{ color: designSystem.colors.text }}>{t('manage_your_tables', language)}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={openBulkAddModal}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium transition-colors"
                style={{ background: designSystem.colors.secondary, color: designSystem.colors.primary }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = designSystem.colors.primary;
                  e.currentTarget.style.color = designSystem.colors.secondary;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = designSystem.colors.secondary;
                  e.currentTarget.style.color = designSystem.colors.primary;
                }}
              >
                <PlusCircle size={16} className="mr-2" style={{ color: designSystem.colors.primary }} />
                {t('bulk_add_tables', language)}
              </button>
              <button
                onClick={openAddModal}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium transition-colors"
                style={{ background: designSystem.colors.primary, color: designSystem.colors.white }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = designSystem.colors.secondary;
                  e.currentTarget.style.color = designSystem.colors.primary;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = designSystem.colors.primary;
                  e.currentTarget.style.color = designSystem.colors.white;
                }}
              >
                <PlusCircle size={16} className="mr-2" style={{ color: designSystem.colors.white }} />
                {t('add_table', language)}
              </button>
            </div>
          </div>
          <div className="mt-4">
            {/* Search */}
            <div className="relative max-w-xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={18} style={{ color: designSystem.colors.iconFiltercolor }} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('search_tables', language)}
                className="pl-10 block w-full py-3 border rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
                style={{ borderColor: designSystem.colors.iconFiltercolor, color: designSystem.colors.text }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  style={{ color: designSystem.colors.secondary }}
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tables Grid */}
        <div className="p-4 sm:p-6">
          {filteredTables.length === 0 ? (
            <div className="text-center py-10">
              <TableIcon size={48} className="mx-auto" style={{ color: designSystem.colors.secondary }} />
              <h3 className="mt-2 text-sm font-medium" style={{ color: designSystem.colors.primary }}>{t('no_tables', language)}</h3>
              <p className="mt-1 text-sm" style={{ color: designSystem.colors.secondary }}>
                {tables.length === 0 ? 
                  t('get_started_by_creating_table', language) : 
                  t('no_tables_match_search', language)}
              </p>
              {tables.length === 0 && (
                <div className="mt-6">
                  <button
                    onClick={openAddModal}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium"
                    style={{ background: designSystem.colors.primary, color: designSystem.colors.white }}
                  >
                    <PlusCircle size={16} className="mr-2" style={{ color: designSystem.colors.secondary }} />
                    {t('add_table', language)}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredTables.map((table) => {
                let statusBg, statusText, statusBar;
                if (table.status === 'available') {
                  statusBg = designSystem.colors.statusReadyBg;
                  statusText = designSystem.colors.statusReadyText;
                  statusBar = designSystem.colors.statusReadyText;
                } else if (table.status === 'reserved') {
                  statusBg = designSystem.colors.statusPendingBg;
                  statusText = designSystem.colors.statusPendingText;
                  statusBar = designSystem.colors.statusPendingText;
                } else {
                  statusBg = designSystem.colors.statusCancelledBg;
                  statusText = designSystem.colors.statusCancelledText;
                  statusBar = designSystem.colors.statusCancelledText;
                }
                return (
                  <div 
                    key={table.id} 
                    className="relative border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                    style={{ background: designSystem.colors.white, borderColor: designSystem.colors.borderLightGray }}
                  >
                    <div style={{ position: 'absolute', top: 0, left: 0, width: 8, height: '100%', background: statusBar }} />
                    <div className="p-4 pl-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-semibold" style={{ color: designSystem.colors.primary }}>
                            {table.name || `Table ${table.number}`}
                          </h3>
                          <p className="text-sm" style={{ color: designSystem.colors.primary }}>
                            {t('table_number', language) + ` ${table.number}`}
                          </p>
                          <span
                            className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                            style={{ background: statusBg, color: statusText }}
                          >
                            {table.status.charAt(0).toUpperCase() + table.status.slice(1)}
                          </span>
                        </div>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => openEditModal(table)}
                            style={{ color: designSystem.colors.secondary }}
                            className="p-1"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => deleteTable(table.id)}
                            disabled={isDeleting}
                            style={{ color: designSystem.colors.secondary }}
                            className="p-1 disabled:opacity-50"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              {/* Modal overlay uses design system color and correct opacity */}
              <div
                className="absolute inset-0"
                style={{ background: designSystem.colors.modalOverlay, opacity: 1 }}
              ></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-secondary rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-primary">
                      {editingTable ? t('edit_table', language) : (bulkMode ? t('add_multiple_tables', language) : t('add_table', language))}
                    </h3>
                    <div className="mt-4">
                      <form onSubmit={handleSubmit}>
                        {bulkMode ? (
                          <>
                            <div className="mb-4">
                              <label htmlFor="number" className="block text-sm font-medium text-primary">
                                {t('starting_table_number', language)}*
                              </label>
                              <input
                                type="number"
                                id="number"
                                name="number"
                                min="1"
                                value={formData.number}
                                onChange={handleInputChange}
                                className="mt-1 block w-full rounded-md shadow-sm border-2 border-primary focus:ring-primary focus:border-primary sm:text-sm"
                                style={{
                                  borderColor: designSystem.colors.inputBorder,
                                  background: designSystem.colors.inputBg,
                                  color: designSystem.colors.text,
                                  paddingTop: '0.75rem',
                                  paddingBottom: '0.75rem',
                                  paddingLeft: '1rem',
                                  paddingRight: '1rem',
                                }}
                                required
                              />
                            </div>
                            <div className="mb-4">
                              <label htmlFor="tableCount" className="block text-sm font-medium text-primary">
                                {t('number_of_tables_to_add', language)}*
                              </label>
                              <input
                                type="number"
                                id="tableCount"
                                min="1"
                                value={tableCount}
                                onChange={handleTableCountChange}
                                className="mt-1 block w-full rounded-md shadow-sm border-2 border-primary focus:ring-primary focus:border-primary sm:text-sm"
                                style={{
                                  borderColor: designSystem.colors.inputBorder,
                                  background: designSystem.colors.inputBg,
                                  color: designSystem.colors.text,
                                  paddingTop: '0.75rem',
                                  paddingBottom: '0.75rem',
                                  paddingLeft: '1rem',
                                  paddingRight: '1rem',
                                }}
                                required
                              />
                            </div>
                            <div className="p-4 bg-background rounded-md">
                              <h4 className="text-sm font-medium text-secondary mb-2">{t('preview', language)}:</h4>
                              <div className="text-sm text-secondary">
                                {Array.from({ length: Math.min(tableCount, 5) }, (_, i) => (
                                  <div key={i} className="mb-1">
                                    {t('table_number', language) + ` ${formData.number + i}}`}: {t('table', language) + ` ${formData.number + i}`}
                                  </div>
                                ))}
                                {tableCount > 5 && (
                                  <div className="text-accent italic">
                                    {t('and_more_tables', language) + ` ${tableCount - 5}`}
                                  </div>
                                )}
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="mb-4">
                              <label htmlFor="number" className="block text-sm font-medium text-primary">
                                {t('table_number', language)}*
                              </label>
                              <input
                                type="number"
                                id="number"
                                name="number"
                                min="1"
                                value={formData.number}
                                onChange={handleInputChange}
                                className="mt-1 block w-full rounded-md shadow-sm border-2 border-primary focus:ring-primary focus:border-primary sm:text-sm"
                                style={{
                                  borderColor: designSystem.colors.inputBorder,
                                  background: designSystem.colors.inputBg,
                                  color: designSystem.colors.text,
                                  paddingTop: '0.75rem',
                                  paddingBottom: '0.75rem',
                                  paddingLeft: '1rem',
                                  paddingRight: '1rem',
                                }}
                                required
                              />
                            </div>
                            <div className="mb-4">
                              <label htmlFor="name" className="block text-sm font-medium text-primary">
                                {t('table_name_optional', language)}
                              </label>
                              <input
                                type="text"
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                placeholder={t('table_placeholder', language) + ` ${formData.number}`}
                                className="mt-1 block w-full rounded-md shadow-sm border-2 border-primary focus:ring-accent focus:border-accent sm:text-sm"
                                style={{
                                  borderColor: designSystem.colors.inputBorder,
                                  background: designSystem.colors.inputBg,
                                  color: designSystem.colors.text,
                                  paddingTop: '0.75rem',
                                  paddingBottom: '0.75rem',
                                  paddingLeft: '1rem',
                                  paddingRight: '1rem',
                                }}
                              />
                            </div>
                            <div className="mb-4">
                              <label htmlFor="status" className="block text-sm font-medium text-primary">
                                {t('status', language)}
                              </label>
                              <select
                                id="status"
                                name="status"
                                value={formData.status}
                                onChange={handleInputChange}
                                className="mt-1 block w-full rounded-md shadow-sm border-2 border-primary focus:ring-primary focus:border-primary sm:text-sm"
                                style={{
                                  borderColor: designSystem.colors.iconFiltercolor,
                                  // background: designSystem.colors.inputBg,
                                  color: designSystem.colors.text,
                                  paddingTop: '0.75rem',
                                  paddingBottom: '0.75rem',
                                  paddingLeft: '1rem',
                                  paddingRight: '1rem',
                                }}
                              >
                                <option value="available">{t('available', language)}</option>
                                <option value="reserved">{t('reserved', language)}</option>
                                <option value="occupied">{t('occupied', language)}</option>
                              </select>
                            </div>
                          </>
                        )}
                      </form>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {loading ? (
                    <LoadingSpinner size={20} color="#ffffff" />
                  ) : (
                    <>
                      <Save size={16} className="mr-2" />
                      {editingTable ? t('save_changes', language) : (bulkMode ? t('add_tables', language) + ` ${tableCount}` : t('add_table', language))}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={loading}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {t('cancel', language)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default TableManagement;