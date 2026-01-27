import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { Building2, Plus, Users, Crown, Shield, User, Settings, LogOut } from 'lucide-react';
import { SkeletonTable } from "@components/common";
import { UserCompanyRef } from '../../types/models';
import { showErrorToast } from '@utils/core/toast';
import PendingInvitationsBanner from '@components/invitations/PendingInvitationsBanner';
import { getCompanyById } from '@services/firestore/companies/companyPublic';
import { getUserById } from '@services/utilities/userService';
import { getTemplateById } from '@services/firestore/employees/permissionTemplateService';

interface CompanyCardProps {
  company: UserCompanyRef;
  onSelect: (companyId: string) => void;
  isLoading?: boolean;
  ownerName?: string;
}

const CompanyCard: React.FC<CompanyCardProps> = ({ company, onSelect, isLoading = false, ownerName }) => {
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4 text-purple-600" />;
      case 'admin':
        return <Shield className="h-4 w-4 text-red-600" />;
      case 'manager':
        return <Users className="h-4 w-4 text-blue-600" />;
      default:
        return <User className="h-4 w-4 text-green-600" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'admin':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'manager':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner':
        return 'Propriétaire';
      case 'admin':
        return 'Administrateur';
      case 'manager':
        return 'Gestionnaire';
      default:
        return 'Employé';
    }
  };

  return (
    <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group">
      <div 
        className="p-6"
        onClick={() => !isLoading && onSelect(company.companyId)}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
              {company.logo ? (
                <img 
                  src={company.logo} 
                  alt={`${company.name} logo`}
                  className="w-full h-full rounded-lg object-cover"
                />
              ) : (
                <Building2 className="h-6 w-6 text-white" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">
                {company.name}
              </h3>
              {company.description && (
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                  {company.description}
                </p>
              )}
              {ownerName && (
                <p className="text-xs text-gray-400 mt-1">
                  Propriétaire: {ownerName}
                </p>
              )}
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getRoleBadgeColor(company.role)}`}>
            <div className="flex items-center space-x-1">
              {getRoleIcon(company.role)}
              <span>{getRoleLabel(company.role)}</span>
            </div>
          </div>
        </div>

        {company.permissionTemplateId && (
          <div className="mb-4 p-2 bg-gray-50 rounded-md">
            <div className="flex items-center space-x-2">
              <Settings className="h-4 w-4 text-gray-500" />
              <span className="text-xs text-gray-600">Template de permissions assigné</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Rejoint le {new Date(company.joinedAt.seconds * 1000).toLocaleDateString('fr-FR')}
          </div>
          <Button
            size="sm"
            variant="outline"
            isLoading={isLoading}
            disabled={isLoading}
            className="group-hover:bg-emerald-50 group-hover:border-emerald-300 group-hover:text-emerald-600"
          >
            Rejoindre
          </Button>
        </div>
      </div>
    </Card>
  );
};

const EmployeeDashboard: React.FC = () => {
  const { userCompanies, selectCompany, signOut, user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [ownersInfo, setOwnersInfo] = useState<Record<string, string>>({});

  const handleCompanySelect = useCallback(async (companyId: string) => {
    try {
      setIsLoading(true);
      setSelectedCompanyId(companyId);
      await selectCompany(companyId);
      navigate(`/company/${companyId}/dashboard`);
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : 'Erreur lors de la sélection de l\'entreprise');
      setSelectedCompanyId(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectCompany, navigate]);

  // Track if we've already attempted auto-redirect to prevent loops
  const hasAttemptedAutoRedirect = useRef(false);
  const lastUserCompaniesKey = useRef<string>('');

  // Reset auto-redirect flag when userCompanies change
  useEffect(() => {
    const currentKey = userCompanies.map(c => c.companyId).join(',');
    if (currentKey !== lastUserCompaniesKey.current) {
      hasAttemptedAutoRedirect.current = false;
      lastUserCompaniesKey.current = currentKey;
    }
  }, [userCompanies]);

  // Auto-redirect if only one company (but check permissions first for employees)
  useEffect(() => {
    // Only auto-redirect once per company list
    if (hasAttemptedAutoRedirect.current) return;
    
    if (userCompanies.length === 1) {
      const companyRef = userCompanies[0];
      const companyId = companyRef.companyId;
      
      // Check if user is owner/admin (they don't need permission templates)
      if (companyRef.role === 'owner' || companyRef.role === 'admin') {
        // Owner/admin can always access, redirect immediately
        hasAttemptedAutoRedirect.current = true;
        handleCompanySelect(companyId);
        return;
      }
      
      // For employees, check if permission template exists before redirecting
      if (companyRef.permissionTemplateId) {
        // Check if template exists
        getTemplateById(companyId, companyRef.permissionTemplateId)
          .then((template) => {
            hasAttemptedAutoRedirect.current = true;
            if (template) {
              // Template exists, safe to redirect
              handleCompanySelect(companyId);
            }
            // If template is null, don't redirect - let user see the list
            // They can click manually and will see the PermissionTemplateMissing message
          })
          .catch(() => {
            // Error loading template, don't auto-redirect
            hasAttemptedAutoRedirect.current = true;
          });
      } else {
        // No template ID, don't auto-redirect
        hasAttemptedAutoRedirect.current = true;
      }
    }
  }, [userCompanies, handleCompanySelect]);

  // Load owners information
  useEffect(() => {
    const loadOwnersInfo = async () => {
      const owners: Record<string, string> = {};
      
      for (const company of userCompanies) {
        try {
          let ownerId: string | null = null;
          
          // If current user is the owner, use their info
          if (company.role === 'owner' && user) {
            const fullName = user.email || 'Propriétaire';
            owners[company.companyId] = fullName;
            continue;
          }
          
          // Otherwise, fetch company document to get owner ID
          const companyDoc = await getCompanyById(company.companyId);
          if (companyDoc && companyDoc.userId) {
            ownerId = companyDoc.userId;
          } else if (companyDoc && companyDoc.companyId) {
            // Fallback for older companies where companyId is the userId
            ownerId = companyDoc.companyId;
          }
          
          // Fetch owner user info
          if (ownerId) {
            const ownerUser = await getUserById(ownerId);
            if (ownerUser) {
              const fullName = ownerUser.username || ownerUser.email || 'Propriétaire';
              owners[company.companyId] = fullName;
            }
          }
        } catch (error) {
          console.error(`Error fetching owner for company ${company.companyId}:`, error);
          owners[company.companyId] = 'Propriétaire inconnu';
        }
      }
      
      setOwnersInfo(owners);
    };
    
    if (userCompanies.length > 0) {
      loadOwnersInfo();
    }
  }, [userCompanies, user]);

  const handleCreateCompany = () => {
    navigate('/company/create');
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await signOut();
      navigate('/auth/login');
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : 'Erreur lors de la déconnexion');
      setIsLoggingOut(false);
    }
  };

  if (isLoading && userCompanies.length === 1) {
    return <SkeletonTable rows={5} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Pending Invitations Banner */}
        {user?.email && (
          <PendingInvitationsBanner userEmail={user.email} />
        )}

        {/* Header with Logout Button */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Vos Entreprises
            </h1>
            <p className="text-gray-600">
              Gérez vos accès aux entreprises et créez votre propre entreprise
            </p>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            icon={<LogOut className="h-4 w-4" />}
            isLoading={isLoggingOut}
            disabled={isLoggingOut}
            className="flex-shrink-0"
          >
            Déconnexion
          </Button>
        </div>

        {/* Companies Grid */}
        {userCompanies.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {userCompanies.map((company: UserCompanyRef) => (
              <CompanyCard
                key={company.companyId}
                company={company}
                onSelect={handleCompanySelect}
                isLoading={selectedCompanyId === company.companyId}
                ownerName={ownersInfo[company.companyId]}
              />
            ))}
          </div>
        ) : (
          /* Empty State */
          <Card className="text-center py-12 mb-8">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building2 className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Aucune entreprise
              </h3>
              <p className="text-gray-600 mb-6">
                Vous n'avez pas encore été invité à rejoindre une entreprise. 
                Créez votre propre entreprise pour commencer.
              </p>
              <Button
                onClick={handleCreateCompany}
                icon={<Plus className="h-5 w-5" />}
                className="mx-auto"
              >
                Créer votre entreprise
              </Button>
            </div>
          </Card>
        )}

        {/* Create Company Section */}
        {userCompanies.length > 0 && (
          <Card className="bg-gradient-to-r from-emerald-50 to-emerald-100 border-emerald-200">
            <div className="p-6 text-center">
              <h3 className="text-lg font-semibold text-emerald-900 mb-2">
                Vous voulez créer votre propre entreprise ?
              </h3>
              <p className="text-emerald-700 mb-4">
                Lancez votre entreprise et gérez vos ventes, produits et équipe
              </p>
              <Button
                onClick={handleCreateCompany}
                variant="outline"
                icon={<Plus className="h-5 w-5" />}
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-200"
              >
                Créer une nouvelle entreprise
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default EmployeeDashboard;
