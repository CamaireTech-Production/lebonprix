import React, { useState, useEffect } from 'react';
import { Users, UserCheck, AlertTriangle, RefreshCw } from 'lucide-react';
import { 
  getEmployeesFromCompanyDoc, 
  getEmployeeCount,
  detectEmployeeInconsistencies,
  repairEmployeeSync 
} from '@services/firestore/employees/employeeDisplayService';
import { CompanyEmployee } from '../../types/models';

interface EmployeeListProps {
  companyId: string;
  companyName: string;
}

interface InconsistencyReport {
  isConsistent: boolean;
  issues: string[];
  details: {
    companyCount: number;
    subcollectionCount: number;
  };
}

export default function EmployeeList({ companyId, companyName }: EmployeeListProps) {
  const [employees, setEmployees] = useState<Record<string, CompanyEmployee>>({});
  const [employeeCount, setEmployeeCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [inconsistencyReport, setInconsistencyReport] = useState<InconsistencyReport | null>(null);
  const [isRepairing, setIsRepairing] = useState(false);

  useEffect(() => {
    loadEmployees();
    checkConsistency();
  }, [companyId]);

  const loadEmployees = async () => {
    try {
      setIsLoading(true);
      
      // Charger les employés depuis company.employees{} (rapide)
      const employeesData = await getEmployeesFromCompanyDoc(companyId);
      setEmployees(employeesData);
      
      // Charger le nombre d'employés
      const count = await getEmployeeCount(companyId);
      setEmployeeCount(count);
      
    } catch (error) {
      console.error('Erreur lors du chargement des employés:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkConsistency = async () => {
    try {
      const report = await detectEmployeeInconsistencies(companyId);
      setInconsistencyReport({
        isConsistent: report.isConsistent,
        issues: report.issues,
        details: {
          companyCount: report.details.companyCount,
          subcollectionCount: report.details.subcollectionCount
        }
      });
    } catch (error) {
      console.error('Erreur lors de la vérification de cohérence:', error);
    }
  };

  const handleRepairSync = async () => {
    try {
      setIsRepairing(true);
      await repairEmployeeSync(companyId);
      
      // Recharger les données après réparation
      await loadEmployees();
      await checkConsistency();
      
      console.log('✅ Synchronisation réparée');
    } catch (error) {
      console.error('Erreur lors de la réparation:', error);
    } finally {
      setIsRepairing(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 text-purple-800';
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'manager':
        return 'bg-blue-100 text-blue-800';
      case 'staff':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner':
        return 'Propriétaire';
      case 'admin':
        return 'Administrateur';
      case 'manager':
        return 'Manager';
      case 'staff':
        return 'Employé';
      default:
        return role;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="space-y-3 w-full max-w-md px-4">
          <div className="animate-pulse bg-gray-100 w-48 h-5 rounded" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-100 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="animate-pulse bg-gray-100 w-10 h-10 rounded-full" />
                  <div>
                    <div className="animate-pulse bg-gray-100 w-32 h-4 rounded mb-2" />
                    <div className="animate-pulse bg-gray-100 w-24 h-3 rounded" />
                  </div>
                </div>
                <div className="animate-pulse bg-gray-100 w-20 h-6 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec statistiques */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-indigo-600 mr-3" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Employés de {companyName}
              </h2>
              <p className="text-gray-600">
                {employeeCount} employé{employeeCount > 1 ? 's' : ''} au total
              </p>
            </div>
          </div>
          
          {/* Indicateur de cohérence */}
          {inconsistencyReport && (
            <div className="flex items-center space-x-2">
              {inconsistencyReport.isConsistent ? (
                <div className="flex items-center text-green-600">
                  <UserCheck className="h-5 w-5 mr-1" />
                  <span className="text-sm font-medium">Cohérent</span>
                </div>
              ) : (
                <div className="flex items-center text-orange-600">
                  <AlertTriangle className="h-5 w-5 mr-1" />
                  <span className="text-sm font-medium">Incohérences</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Alerte d'incohérence */}
      {inconsistencyReport && !inconsistencyReport.isConsistent && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 mr-3" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-orange-800">
                Incohérences détectées
              </h3>
              <div className="mt-2 text-sm text-orange-700">
                <p>Company.employees: {inconsistencyReport.details.companyCount}</p>
                <p>Sous-collection: {inconsistencyReport.details.subcollectionCount}</p>
                <ul className="mt-2 list-disc list-inside">
                  {inconsistencyReport.issues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-3">
                <button
                  onClick={handleRepairSync}
                  disabled={isRepairing}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
                >
                  {isRepairing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Réparation...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Réparer la synchronisation
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Liste des employés */}
      <div className="bg-white rounded-lg shadow">
        {Object.keys(employees).length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Aucun employé trouvé
            </h3>
            <p className="text-gray-600">
              Cette entreprise n'a pas encore d'employés.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {Object.values(employees).map((employee) => (
              <div key={employee.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-indigo-600">
                        {employee.username[0]?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900">
                        {employee.username}
                      </h3>
                      <p className="text-gray-600">{employee.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(employee.role)}`}>
                      {getRoleLabel(employee.role)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Informations de débogage (développement uniquement) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Informations de débogage</h4>
          <div className="text-xs text-gray-600 space-y-1">
            <p>Source: company.employees{} (lecture rapide)</p>
            <p>Employés chargés: {Object.keys(employees).length}</p>
            <p>Compteur: {employeeCount}</p>
            {inconsistencyReport && (
              <p>Cohérence: {inconsistencyReport.isConsistent ? '✅' : '❌'}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
