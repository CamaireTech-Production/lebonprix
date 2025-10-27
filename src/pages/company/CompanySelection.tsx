import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Building2, Plus, Users, Crown, User } from 'lucide-react';
import { Company } from '../../types/models';
import Navbar from '../../components/layout/Navbar';
import Sidebar from '../../components/layout/Sidebar';
import MobileNav from '../../components/layout/MobileNav';
import { FloatingActionButton } from '../../components/common/Button';
import LockedTabModal from '../../components/modals/LockedTabModal';

// Fix the type for role to match main Company type expectations.
interface CompanyWithRole extends Company {
  role: "Companie";
}

const CompanySelection: React.FC = () => {
const { userId } = useParams<{ userId: string }>();
const navigate = useNavigate();
const { selectCompany } = useAuth();

const [companies, setCompanies] = useState<CompanyWithRole[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [sidebarOpen, setSidebarOpen] = useState(false);
const [isMobile, setIsMobile] = useState(false);
const [showLockedModal, setShowLockedModal] = useState(false);
const [selectedMode, setSelectedMode] = useState<string | null>(null);

useEffect(() => {
if (userId) {
loadUserCompanies(userId);
const mode = localStorage.getItem('selectedMode');
setSelectedMode(mode);
}
}, [userId]);

useEffect(() => {
const checkMobile = () => setIsMobile(window.innerWidth < 768);
checkMobile();
window.addEventListener('resize', checkMobile);
return () => window.removeEventListener('resize', checkMobile);
}, []);

const loadUserCompanies = async (userId: string) => {
try {
setLoading(true);
setError(null);
const userDoc = await getDoc(doc(db, 'users', userId));
if (!userDoc.exists()) {
setError('Utilisateur non trouvé');
return;
}

  const userData = userDoc.data();
  if (!userData?.companies || userData.companies.length === 0) {
    setCompanies([]);
    return;
  }

  const companiesDetails = await Promise.all(
    userData.companies.map(async (companyRef: any) => {
      const companyDoc = await getDoc(doc(db, 'companies', companyRef.companyId));
      if (companyDoc.exists()) {
        return {
          ...companyDoc.data(),
          id: companyDoc.id,
          role: companyRef.role,
        } as CompanyWithRole;
      }
      return null;
    })
  );

  setCompanies(companiesDetails.filter(Boolean) as CompanyWithRole[]);
} catch (err) {
  console.error('Erreur lors du chargement des entreprises:', err);
  setError('Erreur lors du chargement des entreprises');
} finally {
  setLoading(false);
}


};

const getFilteredCompanies = () => {
return selectedMode === 'company'
? companies.filter((c) => c.role === 'owner')
: companies;
};

const handleCompanySelection = async (companyId: string) => {
try {
await selectCompany(companyId);
navigate(`/company/${companyId}/dashboard`);
} catch (err) {
console.error("Erreur lors de la sélection de l'entreprise:", err);
setError("Erreur lors de la sélection de l'entreprise");
}
};

const handleCreateCompany = () => navigate('/company/create');

const getRoleBadgeColor = (role: string) => {
switch (role) {
case 'owner':
return 'bg-yellow-100 text-yellow-800';
case 'manager':
return 'bg-blue-100 text-blue-800';
default:
return 'bg-gray-100 text-gray-800';
}
};

const getRoleIcon = (role: string) => {
switch (role) {
case 'owner':
return <Crown className="h-4 w-4 text-yellow-600" />;
case 'manager':
return <Users className="h-4 w-4 text-blue-600" />;
default:
return <User className="h-4 w-4 text-gray-600" />;
}
};

const getRoleLabel = (role: string) => {
switch (role) {
case 'owner':
return 'Propriétaire';
case 'manager':
return 'Manager';
case 'employee':
return 'Employé';
default:
return 'Membre';
}
};

const filteredCompanies = getFilteredCompanies();

return (
  <div className="flex h-screen bg-gray-50">
    <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} isSelectionMode={true} />
    <div className="flex-1 flex flex-col overflow-hidden">
      <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} isSelectionMode={true} />
      <main className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin h-10 w-10 border-b-2 border-indigo-600 rounded-full mx-auto mb-3"></div>
              <p className="text-gray-600">Chargement de vos entreprises...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-red-600 text-2xl">⚠️</span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Erreur</h2>
              <p className="text-gray-600 mb-6">{error}</p>
              <button
            onClick={() => window.location.reload()}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
            Réessayer </button> </div> </div>
            ) : filteredCompanies.length === 0 ? ( <div className="text-center py-16"> <Building2 className="h-16 w-16 text-gray-400 mx-auto mb-4" /> <h3 className="text-lg font-medium text-gray-900 mb-2">
            {selectedMode === 'company'
            ? 'Aucune entreprise trouvée'
            : 'Aucun employeur trouvé'} </h3> <p className="text-gray-600 mb-6">
            {selectedMode === 'company'
            ? "Vous n'êtes pas encore propriétaire d'une entreprise."
            : "Vous n'êtes pas encore employé dans une entreprise."} </p> <button
                        onClick={handleCreateCompany}
                        className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                      > <Plus className="h-4 w-4 mr-2" />
            Créer ma première entreprise </button> </div>
            ) : ( <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCompanies.map((company) => (
            <div
            key={company.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => handleCompanySelection(company.id)}
            > <div className="p-6"> <div className="flex items-start justify-between mb-4">
            {company.logo ? ( <img
                                  src={company.logo}
                                  alt={company.name}
                                  className="h-12 w-12 rounded-lg object-cover"
                                />
            ) : ( <div className="h-12 w-12 bg-indigo-100 rounded-lg flex items-center justify-center"> <Building2 className="h-6 w-6 text-indigo-600" /> </div>
            )}
            <div
            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(
                                      company.role
                                    )}`}
            >
            {getRoleIcon(company.role)} <span className="ml-1">{getRoleLabel(company.role)}</span> </div> </div> <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {company.name} </h3>
            {company.description && ( <p className="text-gray-600 text-sm mb-4 line-clamp-2">
            {company.description} </p>
            )} <div className="flex items-center justify-between"> <div className="text-sm text-gray-500">
            {company.employeeCount || 0} employé
            {(company.employeeCount || 0) > 1 ? 's' : ''} </div> <button className="text-indigo-600 hover:text-indigo-700 font-medium text-sm">
            Accéder → </button> </div> </div> </div>
            ))} </div>
            )} </main>

    {isMobile && <MobileNav />}
    <FloatingActionButton onClick={handleCreateCompany} label="Créer une entreprise" />
    {showLockedModal && (
      <LockedTabModal isOpen={showLockedModal} onClose={() => setShowLockedModal(false)} onCreateCompany={handleCreateCompany} />
    )}
    <Outlet />
  </div>
</div>

);
};

export default CompanySelection;
