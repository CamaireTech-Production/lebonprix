import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ModalFooter, Button, LoadingScreen, Badge } from '@components/common';
import { useAuth } from '@contexts/AuthContext';
import { getCompanyEmployees } from '@services/firestore/employees/employeeRefService';
import { showSuccessToast, showErrorToast } from '@utils/core/toast';
import { UserCheck, Eye, X } from 'lucide-react';
import type { EmployeeRef } from '../../types/models';

interface AssignUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationType: 'shop' | 'warehouse';
  locationId: string;
  locationName: string;
  currentAssignedUsers?: string[]; // Users with full access
  currentReadOnlyUsers?: string[]; // Users with read-only access
  onUpdate: (assignedUsers: string[], readOnlyUsers: string[]) => Promise<void>;
}

const AssignUsersModal: React.FC<AssignUsersModalProps> = ({
  isOpen,
  onClose,
  locationType,
  locationId,
  locationName,
  currentAssignedUsers = [],
  currentReadOnlyUsers = [],
  onUpdate
}) => {
  const { t } = useTranslation();
  const { company } = useAuth();
  const [employees, setEmployees] = useState<EmployeeRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // State for selected users
  const [assignedUsers, setAssignedUsers] = useState<Set<string>>(new Set(currentAssignedUsers));
  const [readOnlyUsers, setReadOnlyUsers] = useState<Set<string>>(new Set(currentReadOnlyUsers));

  // Load employees when modal opens
  useEffect(() => {
    if (isOpen && company?.id) {
      loadEmployees();
    }
  }, [isOpen, company?.id]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setAssignedUsers(new Set(currentAssignedUsers));
      setReadOnlyUsers(new Set(currentReadOnlyUsers));
    }
  }, [isOpen, currentAssignedUsers, currentReadOnlyUsers]);

  const loadEmployees = async () => {
    if (!company?.id) return;
    
    try {
      setLoading(true);
      const companyEmployees = await getCompanyEmployees(company.id);
      setEmployees(companyEmployees);
    } catch (error) {
      console.error('Error loading employees:', error);
      showErrorToast('Erreur lors du chargement des employés');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUser = (userId: string, accessType: 'full' | 'readonly') => {
    if (accessType === 'full') {
      // Toggle full access
      const newAssigned = new Set(assignedUsers);
      if (newAssigned.has(userId)) {
        newAssigned.delete(userId);
      } else {
        newAssigned.add(userId);
        // Remove from read-only if present
        const newReadOnly = new Set(readOnlyUsers);
        newReadOnly.delete(userId);
        setReadOnlyUsers(newReadOnly);
      }
      setAssignedUsers(newAssigned);
    } else {
      // Toggle read-only access
      const newReadOnly = new Set(readOnlyUsers);
      if (newReadOnly.has(userId)) {
        newReadOnly.delete(userId);
      } else {
        newReadOnly.add(userId);
        // Remove from full access if present
        const newAssigned = new Set(assignedUsers);
        newAssigned.delete(userId);
        setAssignedUsers(newAssigned);
      }
      setReadOnlyUsers(newReadOnly);
    }
  };

  const handleRemoveUser = (userId: string) => {
    const newAssigned = new Set(assignedUsers);
    const newReadOnly = new Set(readOnlyUsers);
    newAssigned.delete(userId);
    newReadOnly.delete(userId);
    setAssignedUsers(newAssigned);
    setReadOnlyUsers(newReadOnly);
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      await onUpdate(Array.from(assignedUsers), Array.from(readOnlyUsers));
      showSuccessToast(
        locationType === 'shop' 
          ? 'Utilisateurs assignés au magasin avec succès'
          : 'Utilisateurs assignés à l\'entrepôt avec succès'
      );
      onClose();
    } catch (error) {
      console.error('Error updating users:', error);
      showErrorToast('Erreur lors de la mise à jour des utilisateurs');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get available employees (not already assigned)
  const availableEmployees = employees.filter(
    emp => !assignedUsers.has(emp.id) && !readOnlyUsers.has(emp.id)
  );

  // Get assigned employees with their access type
  const assignedEmployeesList = employees
    .filter(emp => assignedUsers.has(emp.id) || readOnlyUsers.has(emp.id))
    .map(emp => ({
      ...emp,
      accessType: assignedUsers.has(emp.id) ? 'full' as const : 'readonly' as const
    }));

  if (loading) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Chargement...">
        <LoadingScreen />
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Assigner des utilisateurs - ${locationName}`}
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={handleSubmit}
          confirmText="Enregistrer"
          cancelText="Annuler"
          isLoading={isSubmitting}
        />
      }
    >
      <div className="space-y-6">
        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>Accès complet :</strong> L'utilisateur peut créer des ventes, des transferts et modifier le stock.
          </p>
          <p className="text-sm text-blue-900 mt-2">
            <strong>Lecture seule :</strong> L'utilisateur peut voir le stock et les informations, mais ne peut pas effectuer d'opérations.
          </p>
          {locationType === 'shop' && (
            <p className="text-sm text-blue-700 mt-2">
              <strong>Note :</strong> Si aucun utilisateur n'est assigné et que c'est le magasin par défaut, tous les employés de l'entreprise y ont accès.
            </p>
          )}
        </div>

        {/* Assigned Users */}
        {assignedEmployeesList.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Utilisateurs assignés ({assignedEmployeesList.length})
            </h3>
            <div className="space-y-2">
              {assignedEmployeesList.map((emp) => (
                <div
                  key={emp.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {emp.accessType === 'full' ? (
                        <UserCheck className="h-5 w-5 text-green-600" />
                      ) : (
                        <Eye className="h-5 w-5 text-blue-600" />
                      )}
                      <span className="font-medium">
                        {emp.firstname} {emp.lastname}
                      </span>
                    </div>
                    <Badge variant={emp.accessType === 'full' ? 'success' : 'info'} className="text-xs">
                      {emp.accessType === 'full' ? 'Accès complet' : 'Lecture seule'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (emp.accessType === 'full') {
                          handleToggleUser(emp.id, 'readonly');
                        } else {
                          handleToggleUser(emp.id, 'full');
                        }
                      }}
                      className="text-xs"
                    >
                      {emp.accessType === 'full' ? 'Passer en lecture seule' : 'Passer en accès complet'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveUser(emp.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X size={16} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available Employees */}
        {availableEmployees.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Employés disponibles ({availableEmployees.length})
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {availableEmployees.map((emp) => (
                <div
                  key={emp.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50"
                >
                  <span className="font-medium">
                    {emp.firstname} {emp.lastname}
                    {emp.role && (
                      <span className="text-xs text-gray-500 ml-2">({emp.role})</span>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleUser(emp.id, 'readonly')}
                      className="text-xs"
                    >
                      <Eye size={14} className="mr-1" />
                      Lecture seule
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleToggleUser(emp.id, 'full')}
                      className="text-xs"
                    >
                      <UserCheck size={14} className="mr-1" />
                      Accès complet
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {availableEmployees.length === 0 && assignedEmployeesList.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>Aucun employé disponible</p>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default AssignUsersModal;

