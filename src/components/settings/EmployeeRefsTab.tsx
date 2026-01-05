import { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input } from '@components/common';
import { useAuth } from '@contexts/AuthContext';
import { EmployeeRef, User, UserRole } from '../../types/models';
import { 
  searchUserByEmail, 
  addEmployeeToCompany, 
  removeEmployeeFromCompany, 
  updateEmployeeRole,
  getCompanyEmployees,
  subscribeToEmployeeRefs 
} from '@services/firestore/employees/employeeRefService';
import { showErrorToast, showSuccessToast } from '@utils/core/toast';
import { User as UserIcon, Plus, Trash2, Edit3, Search } from 'lucide-react';

const roleOptions: { value: UserRole; label: string }[] = [
  { value: 'staff', label: 'Employé' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Administrateur' }
];

export default function EmployeeRefsTab() {
  const { company } = useAuth();
  
  // États pour la recherche d'utilisateurs
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('staff');

  // États pour les employés
  const [employees, setEmployees] = useState<EmployeeRef[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  // États pour l'édition
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRef | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Charger les employés au montage du composant
  useEffect(() => {
    if (!company?.id) return;

    setIsLoading(true);
    
    // Récupérer les employés initiaux
    getCompanyEmployees(company.id)
      .then(setEmployees)
      .catch(error => {
        console.error('Erreur lors du chargement des employés:', error);
        showErrorToast('Erreur lors du chargement des employés');
      })
      .finally(() => setIsLoading(false));

    // S'abonner aux changements
    const unsubscribe = subscribeToEmployeeRefs(company.id, (newEmployees) => {
      console.log(`🔄 [EmployeeRefsTab] Liste des employés mise à jour:`, newEmployees.length, 'employés');
      console.log(`🔄 [EmployeeRefsTab] Rôles:`, newEmployees.map(e => ({ id: e.id, role: e.role, name: `${e.firstname} ${e.lastname}` })));
      setEmployees(newEmployees);
    });

    return () => unsubscribe();
  }, [company?.id]);

  // Rechercher des utilisateurs par email
  const handleSearch = async () => {
    if (!searchEmail.trim() || searchEmail.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchUserByEmail(searchEmail.trim());
      setSearchResults(results);
    } catch (error) {
      console.error('Erreur lors de la recherche:', error);
      showErrorToast('Erreur lors de la recherche d\'utilisateurs');
    } finally {
      setIsSearching(false);
    }
  };

  // Ajouter un employé
  const handleAddEmployee = async () => {
    if (!selectedUser || !company) return;

    setIsAdding(true);
    try {
      await addEmployeeToCompany(
        company.id,
        selectedUser.id,
        selectedRole,
        {
          name: company.name,
          description: company.description,
          logo: company.logo
        }
      );

      showSuccessToast(`${selectedUser.firstname} ${selectedUser.lastname} ajouté comme employé`);
      
      // Réinitialiser le formulaire
      setSelectedUser(null);
      setSearchEmail('');
      setSearchResults([]);
      setSelectedRole('staff');
    } catch (error: any) {
      console.error('Erreur lors de l\'ajout de l\'employé:', error);
      showErrorToast(error.message || 'Erreur lors de l\'ajout de l\'employé');
    } finally {
      setIsAdding(false);
    }
  };

  // Supprimer un employé
  const handleRemoveEmployee = async (employee: EmployeeRef) => {
    if (!company) return;

    const confirmed = window.confirm(
      `Êtes-vous sûr de vouloir retirer ${employee.firstname} ${employee.lastname} de l'entreprise ?`
    );

    if (!confirmed) return;

    try {
      await removeEmployeeFromCompany(company.id, employee.id);
      showSuccessToast(`${employee.firstname} ${employee.lastname} retiré de l'entreprise`);
    } catch (error: any) {
      console.error('Erreur lors de la suppression:', error);
      showErrorToast(error.message || 'Erreur lors de la suppression de l\'employé');
    }
  };

  // Modifier le rôle d'un employé
  const handleUpdateRole = async (employee: EmployeeRef, newRole: UserRole) => {
    if (!company) return;

    console.log('🔄 [EmployeeRefsTab] handleUpdateRole appelé:', { employeeId: employee.id, employeeName: `${employee.firstname} ${employee.lastname}`, oldRole: employee.role, newRole });
    
    setIsUpdating(true);
    try {
      console.log('🔄 [EmployeeRefsTab] Appel de updateEmployeeRole...');
      await updateEmployeeRole(company.id, employee.id, newRole);
      console.log('✅ [EmployeeRefsTab] updateEmployeeRole terminé avec succès');
      showSuccessToast(`Rôle de ${employee.firstname} ${employee.lastname} mis à jour`);
      setEditingEmployee(null);
    } catch (error: any) {
      console.error('❌ [EmployeeRefsTab] Erreur lors de la mise à jour du rôle:', error);
      showErrorToast(error.message || 'Erreur lors de la mise à jour du rôle');
    } finally {
      setIsUpdating(false);
    }
  };

  // Vérifier si un utilisateur est déjà employé
  const isUserAlreadyEmployee = (userId: string) => {
    return employees.some(emp => emp.id === userId);
  };

  // Statistiques
  const stats = useMemo(() => {
    const totalEmployees = employees.length;
    const byRole = employees.reduce((acc, emp) => {
      acc[emp.role] = (acc[emp.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { totalEmployees, byRole };
  }, [employees]);

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-2">Chargement des employés...</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center">
            <UserIcon className="h-8 w-8 text-indigo-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Employés</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalEmployees}</p>
            </div>
          </div>
        </Card>
        
        {Object.entries(stats.byRole).map(([role, count]) => (
          <Card key={role} className="p-4">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-indigo-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-indigo-600">{count}</span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500 capitalize">{role}</p>
                <p className="text-2xl font-bold text-gray-900">{count}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Ajouter un employé */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Ajouter un Employé</h3>
        
        <div className="space-y-4">
          {/* Recherche d'utilisateur */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rechercher un utilisateur par email
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="email"
                  placeholder="Entrez l'email de l'utilisateur..."
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10"
                />
              </div>
              <Button
                onClick={handleSearch}
                disabled={isSearching || !searchEmail.trim()}
                variant="outline"
              >
                {isSearching ? 'Recherche...' : 'Rechercher'}
              </Button>
            </div>
          </div>

          {/* Résultats de recherche */}
          {searchResults.length > 0 && (
            <div className="border rounded-lg p-4 bg-gray-50">
              <h4 className="font-medium text-gray-900 mb-2">Résultats de recherche:</h4>
              <div className="space-y-2">
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedUser?.id === user.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : isUserAlreadyEmployee(user.id)
                        ? 'border-red-300 bg-red-50 opacity-50 cursor-not-allowed'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => {
                      if (!isUserAlreadyEmployee(user.id)) {
                        setSelectedUser(user);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          {user.firstname} {user.lastname}
                        </p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                      {isUserAlreadyEmployee(user.id) && (
                        <span className="text-xs text-red-600 font-medium">Déjà employé</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sélection du rôle */}
          {selectedUser && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rôle dans l'entreprise
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Bouton d'ajout */}
          {selectedUser && (
            <Button
              onClick={handleAddEmployee}
              disabled={isAdding || isUserAlreadyEmployee(selectedUser.id)}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              {isAdding ? 'Ajout en cours...' : `Ajouter ${selectedUser.firstname} ${selectedUser.lastname}`}
            </Button>
          )}
        </div>
      </Card>

      {/* Liste des employés */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Employés de l'Entreprise</h3>
        
        {employees.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <UserIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>Aucun employé dans cette entreprise</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employé
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rôle
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ajouté le
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 bg-indigo-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-indigo-600">
                            {employee.firstname[0]}{employee.lastname[0]}
                          </span>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {employee.firstname} {employee.lastname}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {employee.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingEmployee?.id === employee.id ? (
                        <select
                          value={editingEmployee.role}
                          onChange={(e) => setEditingEmployee({
                            ...editingEmployee,
                            role: e.target.value as UserRole
                          })}
                          className="text-sm border border-gray-300 rounded px-2 py-1"
                        >
                          {roleOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          {roleOptions.find(opt => opt.value === employee.role)?.label}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {employee.addedAt ? (employee.addedAt instanceof Date ? employee.addedAt.toLocaleDateString() : (employee.addedAt as any)?.toDate?.()?.toLocaleDateString()) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        {editingEmployee?.id === employee.id ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => {
                                console.log('🖱️ [EmployeeRefsTab] Bouton Sauvegarder cliqué');
                                console.log('🖱️ [EmployeeRefsTab] editingEmployee:', editingEmployee);
                                console.log('🖱️ [EmployeeRefsTab] Nouveau rôle:', editingEmployee.role);
                                const originalEmployee = employees.find(e => e.id === editingEmployee.id);
                                console.log('🖱️ [EmployeeRefsTab] Rôle original:', originalEmployee?.role);
                                
                                // Vérifier si le rôle a vraiment changé
                                if (originalEmployee && originalEmployee.role === editingEmployee.role) {
                                  console.log('⚠️ [EmployeeRefsTab] Le rôle n\'a pas changé, pas de mise à jour nécessaire');
                                  showErrorToast('Le rôle n\'a pas changé');
                                  return;
                                }
                                
                                handleUpdateRole(editingEmployee, editingEmployee.role);
                              }}
                              disabled={isUpdating}
                            >
                              {isUpdating ? 'Sauvegarde...' : 'Sauvegarder'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingEmployee(null)}
                            >
                              Annuler
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingEmployee(employee)}
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRemoveEmployee(employee)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
