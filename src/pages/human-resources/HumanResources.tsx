import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@contexts/AuthContext';
import { useRolePermissions } from '@hooks/business/useRolePermissions';
import { SkeletonTable, Card, Button } from "@components/common";
import { Plus, Users, Search, Filter, UserPlus, Archive, Eye, Edit2, MoreVertical } from 'lucide-react';
import { RESOURCES } from '@constants/resources';
import { useHRActors } from '@hooks/data/useHRActors';
import { HR_ACTOR_TYPE_LABELS } from '@constants/hrActorTypes';
import HRActorForm from './HRActorForm';
import type { HRActor } from '../../types/models';

/**
 * Human Resources Management Page
 *
 * This page manages true HR actors:
 * - Gardiens (Security guards)
 * - Caissiers (Cashiers)
 * - Livreurs (Delivery personnel)
 * - Comptables (Accountants)
 * - Managers
 * - Custom actor types
 *
 * Features:
 * - List all HR actors
 * - Add new HR actors
 * - View/Edit HR actor details
 * - Archive/Disable HR actors
 */
const HumanResources = () => {
  const { t } = useTranslation();
  const { company, effectiveRole, isOwner } = useAuth();
  const { canAccess, canEdit } = useRolePermissions(company?.id);
  const { actors, loading, error, refetch } = useHRActors(company?.id);

  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingActor, setEditingActor] = useState<HRActor | null>(null);
  const [viewingActor, setViewingActor] = useState<HRActor | null>(null);

  // Check permissions
  const isActualOwner = isOwner || effectiveRole === 'owner';
  const hasViewPermission = isActualOwner || canAccess(RESOURCES.HUMAN_RESOURCES);
  const hasEditPermission = isActualOwner || canEdit(RESOURCES.HUMAN_RESOURCES);

  // Filter actors based on tab, search, and type filter
  const filteredActors = actors.filter(actor => {
    // Tab filter
    if (activeTab === 'active' && actor.status === 'archived') return false;
    if (activeTab === 'archived' && actor.status !== 'archived') return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const fullName = `${actor.firstName} ${actor.lastName}`.toLowerCase();
      const phone = actor.phone?.toLowerCase() || '';
      const email = actor.email?.toLowerCase() || '';
      if (!fullName.includes(query) && !phone.includes(query) && !email.includes(query)) {
        return false;
      }
    }

    // Type filter
    if (filterType !== 'all' && actor.actorType !== filterType) {
      return false;
    }

    return true;
  });

  // Get unique actor types for filter dropdown
  const actorTypes = [...new Set(actors.map(a => a.actorType))];

  const handleAddActor = () => {
    setEditingActor(null);
    setShowForm(true);
  };

  const handleEditActor = (actor: HRActor) => {
    setEditingActor(actor);
    setShowForm(true);
  };

  const handleViewActor = (actor: HRActor) => {
    setViewingActor(actor);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingActor(null);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingActor(null);
    refetch();
  };

  if (!hasViewPermission) {
    return (
      <div className="p-6">
        <Card>
          <div className="text-center py-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {t('humanResources.accessDenied', 'Access Denied')}
            </h2>
            <p className="text-gray-600">
              {t('humanResources.noPermission', "You don't have permission to access Human Resources.")}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              {t('humanResources.contactOwner', 'Contact your company owner to grant you access.')}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading) {
    return <SkeletonTable rows={5} />;
  }

  // Show form if adding/editing
  if (showForm) {
    return (
      <div className="p-6">
        <HRActorForm
          actor={editingActor}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
        />
      </div>
    );
  }

  // Show actor details if viewing
  if (viewingActor) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <Button variant="outline" onClick={() => setViewingActor(null)}>
            &larr; {t('common.back', 'Back')}
          </Button>
        </div>
        <Card>
          <div className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Users className="h-8 w-8 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {viewingActor.firstName} {viewingActor.lastName}
                  </h2>
                  <p className="text-gray-600">
                    {HR_ACTOR_TYPE_LABELS[viewingActor.actorType] || viewingActor.customActorType || viewingActor.actorType}
                  </p>
                </div>
              </div>
              {hasEditPermission && (
                <Button onClick={() => handleEditActor(viewingActor)} icon={<Edit2 className="h-4 w-4" />}>
                  {t('common.edit', 'Edit')}
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">{t('humanResources.phone', 'Phone')}</h3>
                <p className="text-gray-900">{viewingActor.phone || '-'}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">{t('humanResources.email', 'Email')}</h3>
                <p className="text-gray-900">{viewingActor.email || '-'}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">{t('humanResources.department', 'Department')}</h3>
                <p className="text-gray-900">{viewingActor.department || '-'}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">{t('humanResources.position', 'Position')}</h3>
                <p className="text-gray-900">{viewingActor.position || '-'}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">{t('humanResources.hireDate', 'Hire Date')}</h3>
                <p className="text-gray-900">
                  {viewingActor.hireDate
                    ? new Date(viewingActor.hireDate.seconds * 1000).toLocaleDateString()
                    : '-'}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">{t('humanResources.status', 'Status')}</h3>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  viewingActor.status === 'active' ? 'bg-green-100 text-green-800' :
                  viewingActor.status === 'inactive' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {viewingActor.status}
                </span>
              </div>
              {viewingActor.salary && (
                <>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">{t('humanResources.salary', 'Salary')}</h3>
                    <p className="text-gray-900">{viewingActor.salary.toLocaleString()} FCFA</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">{t('humanResources.salaryFrequency', 'Frequency')}</h3>
                    <p className="text-gray-900">{viewingActor.salaryFrequency || '-'}</p>
                  </div>
                </>
              )}
              {viewingActor.address && (
                <div className="col-span-2">
                  <h3 className="text-sm font-medium text-gray-500 mb-1">{t('humanResources.address', 'Address')}</h3>
                  <p className="text-gray-900">
                    {viewingActor.address}
                    {viewingActor.city && `, ${viewingActor.city}`}
                    {viewingActor.country && `, ${viewingActor.country}`}
                  </p>
                </div>
              )}
              {viewingActor.emergencyContact && (
                <div className="col-span-2">
                  <h3 className="text-sm font-medium text-gray-500 mb-1">{t('humanResources.emergencyContact', 'Emergency Contact')}</h3>
                  <p className="text-gray-900">
                    {viewingActor.emergencyContact.name} ({viewingActor.emergencyContact.relationship}) - {viewingActor.emergencyContact.phone}
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('humanResources.title', 'Human Resources')}
          </h1>
          <p className="text-gray-600 mt-1">
            {t('humanResources.subtitle', 'Manage your company HR actors')}
          </p>
        </div>
        {hasEditPermission && (
          <Button onClick={handleAddActor} icon={<UserPlus className="h-4 w-4" />}>
            {t('humanResources.addActor', 'Add HR Actor')}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('active')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'active'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t('humanResources.tabs.active', 'Active')} ({actors.filter(a => a.status !== 'archived').length})
          </button>
          <button
            onClick={() => setActiveTab('archived')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'archived'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Archive className="h-4 w-4 inline mr-1" />
            {t('humanResources.tabs.archived', 'Archived')} ({actors.filter(a => a.status === 'archived').length})
          </button>
        </nav>
      </div>

      {/* Search and Filter */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder={t('humanResources.searchPlaceholder', 'Search by name, phone, or email...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none bg-white"
          >
            <option value="all">{t('humanResources.filterAll', 'All Types')}</option>
            {actorTypes.map(type => (
              <option key={type} value={type}>
                {HR_ACTOR_TYPE_LABELS[type] || type}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Actors List */}
      {filteredActors.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery || filterType !== 'all'
                ? t('humanResources.noResults', 'No actors found')
                : t('humanResources.noActors', 'No HR actors yet')}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchQuery || filterType !== 'all'
                ? t('humanResources.tryDifferentSearch', 'Try a different search or filter')
                : t('humanResources.addFirstActor', 'Add your first HR actor to get started')}
            </p>
            {hasEditPermission && !searchQuery && filterType === 'all' && (
              <Button onClick={handleAddActor} icon={<UserPlus className="h-4 w-4" />}>
                {t('humanResources.addActor', 'Add HR Actor')}
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredActors.map(actor => (
            <Card key={actor.id} className="hover:shadow-md transition-shadow">
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                      <Users className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {actor.firstName} {actor.lastName}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {HR_ACTOR_TYPE_LABELS[actor.actorType] || actor.customActorType || actor.actorType}
                      </p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    actor.status === 'active' ? 'bg-green-100 text-green-800' :
                    actor.status === 'inactive' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {actor.status}
                  </span>
                </div>
                <div className="mt-3 text-sm text-gray-600">
                  {actor.phone && <p>{actor.phone}</p>}
                  {actor.department && <p>{actor.department}</p>}
                </div>
                <div className="mt-4 flex items-center justify-end space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewActor(actor)}
                    icon={<Eye className="h-4 w-4" />}
                  >
                    {t('common.view', 'View')}
                  </Button>
                  {hasEditPermission && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditActor(actor)}
                      icon={<Edit2 className="h-4 w-4" />}
                    >
                      {t('common.edit', 'Edit')}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default HumanResources;
