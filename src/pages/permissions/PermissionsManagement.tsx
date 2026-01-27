import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@contexts/AuthContext';
import { useRolePermissions } from '@hooks/business/useRolePermissions';
import { SkeletonTable } from "@components/common";
import InviteEmployeeForm from '@components/hr/InviteEmployeeForm';
import PendingInvitationsList from '@components/hr/PendingInvitationsList';
import TeamOverview from '@components/hr/TeamOverview';
import PermissionTemplateManager from '@components/hr/PermissionTemplateManager';
import ActionRequestsList from '@components/action-requests/ActionRequestsList';
import { getPendingInvitations, subscribeToPendingInvitations } from '@services/firestore/employees/invitationService';
import { getCompanyEmployees, subscribeToEmployeeRefs } from '@services/firestore/employees/employeeRefService';
import { convertEmployeeRefToUserCompanyRef, getOwnerUserCompanyRef } from '@services/firestore/employees/employeeDisplayService';
import { subscribeToActionRequests } from '@services/firestore/hr/actionRequestService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@services/core/firebase';
import { logError } from '@utils/core/logger';
import { RESOURCES } from '@constants/resources';
import type { Invitation, UserCompanyRef, EmployeeRef, ActionRequest } from '../../types/models';

/**
 * Permissions & Invitations Management Page
 *
 * This page manages:
 * - Team Overview: View all employees and their roles
 * - Pending Invitations: Manage invitations sent to new employees
 * - Invite Employee: Send new invitations to join the company
 * - Permission Templates: Create and manage permission templates
 *
 * Note: This was previously called "HR Management" but has been renamed
 * to better reflect its actual functionality (access control, not HR actors).
 */
const PermissionsManagement = () => {
  const { t } = useTranslation();
  const { company, user, effectiveRole, isOwner } = useAuth();
  const { canAccess } = useRolePermissions(company?.id);
  const [activeTab, setActiveTab] = useState<'team' | 'invitations' | 'invite' | 'templates' | 'requests'>('team');
  const [pendingInvitations, setPendingInvitations] = useState<Invitation[]>([]);
  const [teamMembers, setTeamMembers] = useState<UserCompanyRef[]>([]);
  const [actionRequests, setActionRequests] = useState<ActionRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!company?.id) return;

    try {
      setLoading(true);

      // Load pending invitations
      const invitations = await getPendingInvitations(company.id);
      setPendingInvitations(invitations);

      // Load team members from employeeRefs subcollection
      const employees = await getCompanyEmployees(company.id);

      // Convertir les EmployeeRef en UserCompanyRef
      const companyData = {
        name: company.name || '',
        description: company.description,
        logo: company.logo
      };

      // Récupérer les permissionTemplateId depuis users.companies[] pour chaque employé
      const teamMembersList: UserCompanyRef[] = await Promise.all(
        employees.map(async (emp) => {
          try {
            // Récupérer le document utilisateur pour obtenir le permissionTemplateId
            const userDoc = await getDoc(doc(db, 'users', emp.id));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              const companies = userData?.companies;

              if (Array.isArray(companies)) {
                const userCompanyRef = companies.find((c: any) => c.companyId === company.id);
                const permissionTemplateId = userCompanyRef?.permissionTemplateId;

                return convertEmployeeRefToUserCompanyRef(emp, company.id, companyData, permissionTemplateId);
              }
            }
          } catch (error) {
            logError(`Error fetching template for employee ${emp.id}`, error);
          }

          // Fallback si erreur ou si pas de template
          return convertEmployeeRefToUserCompanyRef(emp, company.id, companyData);
        })
      );

      // Ajouter le propriétaire s'il n'est pas déjà dans la liste des employeeRefs
      if (company.companyId) {
        // Vérifier si le propriétaire existe déjà dans la liste des employés
        const ownerExistsInEmployees = employees.some(emp => emp.id === company.companyId);

        if (!ownerExistsInEmployees) {
          // Le propriétaire n'est pas dans employeeRefs, l'ajouter manuellement
          const ownerUserCompanyRef = await getOwnerUserCompanyRef(
            company.companyId,
            company.id,
            companyData
          );

          if (ownerUserCompanyRef) {
            teamMembersList.unshift(ownerUserCompanyRef); // Ajouter en premier
          }
        }
      }

      setTeamMembers(teamMembersList);

    } catch (error) {
      logError('Error loading permissions data', error);
      // En cas d'erreur, initialiser avec un tableau vide
      setTeamMembers([]);
    } finally {
      setLoading(false);
    }
  }, [company?.id, company?.companyId, company?.name, company?.description, company?.logo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Set up real-time listener for pending invitations
  useEffect(() => {
    if (!company?.id) return;

    const unsubscribe = subscribeToPendingInvitations(company.id, (invitations) => {
      setPendingInvitations(invitations);
    });

    // Cleanup listener on unmount
    return () => {
      unsubscribe();
    };
  }, [company?.id]);

  // Set up real-time listener for action requests
  useEffect(() => {
    if (!company?.id) return;

    const unsubscribe = subscribeToActionRequests(company.id, (requests) => {
      setActionRequests(requests);
    });

    // Cleanup listener on unmount
    return () => {
      unsubscribe();
    };
  }, [company?.id]);

  // Set up real-time listener for employeeRefs to update team members dynamically
  useEffect(() => {
    if (!company?.id) return;

    let isUpdating = false; // Prevent recursive updates

    const unsubscribe = subscribeToEmployeeRefs(company.id, async (employees: EmployeeRef[]) => {
      if (isUpdating) {
        return; // Skip if already updating
      }

      isUpdating = true;

      try {
        // Convert EmployeeRefs to UserCompanyRefs
        const companyData = {
          name: company.name || '',
          description: company.description,
          logo: company.logo
        };

        // Get permissionTemplateId from users.companies[] for each employee
        const teamMembersList: UserCompanyRef[] = await Promise.all(
          employees.map(async (emp) => {
            try {
              const userDoc = await getDoc(doc(db, 'users', emp.id));
              if (userDoc.exists()) {
                const userData = userDoc.data();
                const companies = userData?.companies;

                if (Array.isArray(companies)) {
                  const userCompanyRef = companies.find((c: any) => c.companyId === company.id);
                  const permissionTemplateId = userCompanyRef?.permissionTemplateId;

                  return convertEmployeeRefToUserCompanyRef(emp, company.id, companyData, permissionTemplateId);
                }
              }
            } catch (error) {
              logError(`Error fetching template for employee ${emp.id}`, error);
            }

            return convertEmployeeRefToUserCompanyRef(emp, company.id, companyData);
          })
        );

        // Add owner if not in list
        if (company.companyId) {
          const ownerExistsInEmployees = employees.some(emp => emp.id === company.companyId);

          if (!ownerExistsInEmployees) {
            const ownerUserCompanyRef = await getOwnerUserCompanyRef(
              company.companyId,
              company.id,
              companyData
            );

            if (ownerUserCompanyRef) {
              teamMembersList.unshift(ownerUserCompanyRef);
            }
          }
        }

        setTeamMembers(teamMembersList);
      } catch (error) {
        logError('Error updating team members from real-time listener', error);
      } finally {
        isUpdating = false;
      }
    });

    // Cleanup listener on unmount
    return () => {
      unsubscribe();
    };
  }, [company?.id, company?.companyId, company?.name, company?.description, company?.logo]);

  const handleInvitationCreated = () => {
    loadData(); // Refresh data
    setActiveTab('invitations'); // Switch to invitations tab
  };

  const handleInvitationCancelled = () => {
    loadData(); // Refresh data
  };

  // Check if user has permission to access Permissions management
  // Access is controlled by the permission template's canView array
  // Owner always has access (isOwner or effectiveRole === 'owner'), employees need explicit permission
  // Support both legacy 'hr' and new 'permissions' resource for backward compatibility
  const isActualOwner = isOwner || effectiveRole === 'owner';
  const hasPermission = isActualOwner || canAccess(RESOURCES.PERMISSIONS) || canAccess(RESOURCES.HR);

  if (!hasPermission) {
    return (
      <div className="p-6">
        <Card>
          <div className="text-center py-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {t('permissions.accessDenied', 'Access Denied')}
            </h2>
            <p className="text-gray-600">
              {t('permissions.noPermission', "You don't have permission to access permissions management.")}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              {t('permissions.contactOwner', 'Contact your company owner to grant you access via a permission template.')}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading) {
    return <SkeletonTable rows={5} />;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {t('permissions.title', 'Permissions & Invitations')}
        </h1>
        <p className="text-gray-600 mt-1">
          {t('permissions.subtitle', 'Manage team members, invitations, and permission templates')}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <nav className="flex space-x-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('team')}
            className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'team'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t('permissions.tabs.team', 'Team Overview')} ({teamMembers.length})
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'invitations'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t('permissions.tabs.invitations', 'Pending Invitations')} ({pendingInvitations.length})
          </button>
          <button
            onClick={() => setActiveTab('invite')}
            className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'invite'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t('permissions.tabs.invite', 'Invite Employee')}
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'templates'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t('permissions.tabs.templates', 'Permission Templates')}
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'requests'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t('permissions.tabs.requests', 'Action Requests')} ({actionRequests.filter(r => r.status === 'pending').length})
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'team' && (
          <TeamOverview
            teamMembers={teamMembers}
            onRefresh={loadData}
            companyId={company?.id || ''}
          />
        )}

        {activeTab === 'invitations' && (
          <PendingInvitationsList
            invitations={pendingInvitations}
            onInvitationCancelled={handleInvitationCancelled}
          />
        )}

        {activeTab === 'invite' && (
          <InviteEmployeeForm
            onInvitationCreated={handleInvitationCreated}
            companyId={company?.id || ''}
            companyName={company?.name || ''}
            inviterData={{
              id: user?.uid || '',
              name: user?.displayName || 'Company Owner'
            }}
          />
        )}

        {activeTab === 'templates' && (
          <PermissionTemplateManager
            onTemplateChange={loadData}
          />
        )}

        {activeTab === 'requests' && (
          <ActionRequestsList
            companyId={company?.id || ''}
            onRequestProcessed={loadData}
          />
        )}
      </div>
    </div>
  );
};

export default PermissionsManagement;
