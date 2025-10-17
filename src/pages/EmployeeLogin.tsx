import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import { showErrorToast, showSuccessToast } from '../utils/toast';
import { getCompanyById } from '../services/companyPublic';
import type { Company, CompanyEmployee } from '../types/models';
import { useAuth } from '../contexts/AuthContext';

export default function EmployeeLogin() {
  const { companyName, companyId, loginLink } = useParams();
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [employee, setEmployee] = useState<CompanyEmployee | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!companyId) return;
      setLoading(true);
      try {
        const comp = await getCompanyById(companyId);
        setCompany(comp);
        // Rechercher l'employé par loginLink dans le mappage des employés
        const emp = comp?.employees ? 
          Object.values(comp.employees).find(e => e.loginLink === loginLink) || null 
          : null;
        setEmployee(emp || null);
        if (!emp) {
          showErrorToast('Lien invalide ou expiré');
        }
      } catch (e: any) {
        console.error(e);
        showErrorToast(e.message || 'Impossible de charger la compagnie');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [companyId, loginLink]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee?.email) {
      showErrorToast('Employé introuvable');
      return;
    }
    if (!password) {
      showErrorToast('Veuillez saisir votre mot de passe');
      return;
    }
    try {
      await signIn(employee.email, password);
      showSuccessToast('Connexion réussie');
      const name = companyName || (company?.name || '');
      const id = companyId || (company?.id || '');
      navigate(`/catalogue/${encodeURIComponent(name)}/${encodeURIComponent(id)}`);
    } catch (e: any) {
      console.error(e);
      showErrorToast('Informations de connexion incorrectes');
    }
  };

  return (
    <div className="max-w-md mx-auto py-12">
      <Card>
        <h1 className="text-xl font-semibold text-gray-900 mb-4">Login Employé</h1>
        {loading ? (
          <div className="text-sm text-gray-600">Chargement...</div>
        ) : employee ? (
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input label="Firstname" value={employee.firstname} readOnly />
            <Input label="Lastname" value={employee.lastname} readOnly />
            <Input label="Email" type="email" value={employee.email} readOnly />
            <Input label="Mot de passe" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <div className="flex justify-end">
              <Button type="submit">Se connecter</Button>
            </div>
          </form>
        ) : (
          <div className="text-sm text-red-600">Lien invalide. Contactez votre administrateur.</div>
        )}
      </Card>
    </div>
  );
}


