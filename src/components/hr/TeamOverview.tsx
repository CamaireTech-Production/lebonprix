import { useState, useEffect, useCallback } from 'react';
import Card from '../common/Card';
import Button from '../common/Button';
import { Users, UserPlus, RefreshCw, Settings } from 'lucide-react';
import type { UserCompanyRef } from '../../types/models';
import TemplateAssignment from './TemplateAssignment';

interface TeamOverviewProps {
  teamMembers: UserCompanyRef[];
  onRefresh: () => void;
}

interface TeamMember {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  phone?: string;
  role: string;
  joinedAt: import('../../types/models').Timestamp;
  lastLogin?: import('../../types/models').Timestamp;
  permissionTemplateId?: string;
}

const TeamOverview = ({ teamMembers, onRefresh }: TeamOverviewProps) => {
  const [allTeamMembers, setAllTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [showTemplateAssignment, setShowTemplateAssignment] = useState(false);

  const loadTeamMembers = useCallback(async () => {
    try {
      setLoading(true);
      
      // This is a simplified implementation
      // In a real scenario, you'd query users who have access to the current company
      // For now, we'll show the team members from the props
      
      const members: TeamMember[] = teamMembers.map(member => ({
        id: member.companyId,
        firstname: member.name.split(' ')[0] || '',
        lastname: member.name.split(' ').slice(1).join(' ') || '',
        email: '', // Would need to fetch from user data
        role: member.role,
        joinedAt: member.joinedAt,
        permissionTemplateId: member.permissionTemplateId
      }));
      
      setAllTeamMembers(members);
    } catch (error) {
      console.error('Error loading team members:', error);
    } finally {
      setLoading(false);
    }
  }, [teamMembers]);

  useEffect(() => {
    loadTeamMembers();
  }, [loadTeamMembers]);

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'owner': return 'Owner (Propriétaire)';
      case 'admin': return 'Admin (Magasinier)';
      case 'manager': return 'Manager (Gestionnaire)';
      case 'staff': return 'Staff (Vendeur)';
      default: return role;
    }
  };

  const handleTemplateAssignment = (member: TeamMember) => {
    setSelectedMember(member);
    setShowTemplateAssignment(true);
  };

  const handleTemplateAssigned = () => {
    setShowTemplateAssignment(false);
    setSelectedMember(null);
    onRefresh();
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-purple-100 text-purple-800';
      case 'admin': return 'bg-red-100 text-red-800';
      case 'manager': return 'bg-blue-100 text-blue-800';
      case 'staff': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Card>
        <div className="text-center py-8">
          <RefreshCw className="mx-auto h-8 w-8 text-gray-400 animate-spin" />
          <p className="mt-2 text-sm text-gray-500">Loading team members...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Team Overview</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>

        {/* Team Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Total Members</p>
                <p className="text-2xl font-semibold text-gray-900">{allTeamMembers.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <UserPlus className="h-8 w-8 text-green-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Active Members</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {allTeamMembers.filter(m => m.role !== 'owner').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
                <span className="text-yellow-600 font-semibold text-sm">!</span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Admins</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {allTeamMembers.filter(m => m.role === 'admin' || m.role === 'owner').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Team Members List */}
        {allTeamMembers.length === 0 ? (
          <div className="text-center py-8">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No team members</h3>
            <p className="mt-1 text-sm text-gray-500">
              Start by inviting employees to join your team.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {allTeamMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-600">
                      {member.firstname.charAt(0)}{member.lastname.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">
                      {member.firstname} {member.lastname}
                    </h4>
                    <p className="text-sm text-gray-500">{member.email}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(member.role)}`}>
                    {getRoleDisplayName(member.role)}
                  </span>
                  
                  <span className="text-xs text-gray-500">
                    {member.permissionTemplateId ? 'Custom Template' : 'Base Role Only'}
                  </span>
                  
                  {member.lastLogin && (
                    <span className="text-xs text-gray-500">
                      Last active: {new Date(member.lastLogin.seconds * 1000).toLocaleDateString()}
                    </span>
                  )}
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTemplateAssignment(member)}
                    icon={<Settings size={14} />}
                  >
                    Permissions
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Template Assignment Modal */}
        {showTemplateAssignment && selectedMember && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <TemplateAssignment
                userId={selectedMember.id}
                currentTemplateId={selectedMember.permissionTemplateId}
                onTemplateAssigned={handleTemplateAssigned}
                onClose={() => setShowTemplateAssignment(false)}
              />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default TeamOverview;
