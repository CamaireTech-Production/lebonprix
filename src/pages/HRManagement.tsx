import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/common/Card';
import LoadingScreen from '../components/common/LoadingScreen';
import InviteEmployeeForm from '../components/hr/InviteEmployeeForm';
import PendingInvitationsList from '../components/hr/PendingInvitationsList';
import TeamOverview from '../components/hr/TeamOverview';
import PermissionTemplateManager from '../components/hr/PermissionTemplateManager';
import { getPendingInvitations } from '../services/invitationService';
import type { Invitation, UserCompanyRef } from '../types/models';

const HRManagement = () => {
  const { company, user, effectiveRole, isOwner } = useAuth();
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
      
      // Load team members (users with access to this company)
      // This would need to be implemented in userService
      // For now, we'll use an empty array
      setTeamMembers([]);
      
    } catch (error) {
      console.error('Error loading HR data:', error);
    } finally {
      setLoading(false);
    }
  }, [company?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleInvitationCreated = () => {
    loadData(); // Refresh data
    setActiveTab('invitations'); // Switch to invitations tab
  };

  const handleInvitationCancelled = () => {
    loadData(); // Refresh data
  };

  // Check if user has permission to access HR management
  const hasPermission = isOwner || effectiveRole === 'magasinier';
  
  if (!hasPermission) {
    return (
      <div className="p-6">
        <Card>
          <div className="text-center py-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600">You don't have permission to access HR management.</p>
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
