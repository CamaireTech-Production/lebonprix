import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { useRolePermissions } from '@hooks/business/useRolePermissions';
import { Card, LoadingScreen } from '@components/common';
import InviteEmployeeForm from '@components/hr/InviteEmployeeForm';
import PendingInvitationsList from '@components/hr/PendingInvitationsList';
import TeamOverview from '@components/hr/TeamOverview';
import PermissionTemplateManager from '@components/hr/PermissionTemplateManager';
import { getPendingInvitations, subscribeToPendingInvitations } from '@services/firestore/employees/invitationService';
import { getCompanyEmployees } from '@services/firestore/employees/employeeRefService';
import { convertEmployeeRefToUserCompanyRef, getOwnerUserCompanyRef } from '@services/firestore/employees/employeeDisplayService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@services/core/firebase';
import { logError } from '@utils/core/logger';
import type { Invitation, UserCompanyRef } from '../../types/models';

const HRManagement = () => {
  const { company, user, effectiveRole, isOwner } = useAuth();
  const { canAccess } = useRolePermissions(company?.id);
  const [activeTab, setActiveTab] = useState<'team' | 'invitations' | 'invite' | 'templates'>('team');
  const [pendingInvitations, setPendingInvitations] = useState<Invitation[]>([]);
  const [teamMembers, setTeamMembers] = useState<UserCompanyRef[]>([]);
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
      logError('Error loading HR data', error);
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

    console.log('🔔 Setting up real-time listener for pending invitations');
    const unsubscribe = subscribeToPendingInvitations(company.id, (invitations) => {
      console.log('📬 Pending invitations updated:', invitations.length);
      setPendingInvitations(invitations);
    });

    // Cleanup listener on unmount
    return () => {
      console.log('🔕 Unsubscribing from pending invitations listener');
      unsubscribe();
    };
  }, [company?.id]);

  const handleInvitationCreated = () => {
    loadData(); // Refresh data
    setActiveTab('invitations'); // Switch to invitations tab
  };

  const handleInvitationCancelled = () => {
    loadData(); // Refresh data
  };

  // Check if user has permission to access HR management
  // HR access is controlled by the permission template's canAccessHR checkbox
  // Owner always has access (isOwner or effectiveRole === 'owner'), employees need explicit HR permission
  const isActualOwner = isOwner || effectiveRole === 'owner';
  const hasPermission = isActualOwner || canAccess('hr');
  
  if (!hasPermission) {
    return (
      <div className="p-6">
        <Card>
          <div className="text-center py-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600">You don't have permission to access HR management.</p>
            <p className="text-sm text-gray-500 mt-2">Contact your company owner to grant you HR access via a permission template.</p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">HR Management</h1>
        <p className="text-gray-600 mt-1">Manage your team members and invitations</p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('team')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'team'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Team Overview ({teamMembers.length})
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'invitations'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Pending Invitations ({pendingInvitations.length})
          </button>
          <button
            onClick={() => setActiveTab('invite')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'invite'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Invite Employee
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'templates'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Permission Templates
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
      </div>
    </div>
  );
};

export default HRManagement;
