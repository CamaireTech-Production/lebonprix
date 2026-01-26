import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Building2, LogOut, ArrowLeft } from 'lucide-react';
import { useAuth } from '@contexts/AuthContext';
import Card from '@components/common/Card';
import Button from '@components/common/Button';

const PermissionTemplateMissing = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { company, signOut } = useAuth();

  const handleGoBack = () => {
    // Navigate to employee dashboard (which shows company selection)
    // This will show the list of companies even if user has only one
    // The EmployeeDashboard will not auto-redirect if template is missing
    navigate('/employee/dashboard');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth/login');
  };

  return (
    <div className="min-h-screen flex items-start justify-center bg-gray-50 p-4 pt-16 md:pt-24">
      <div className="max-w-2xl w-full">
        <Card className="p-8">
          {/* Icon and Title */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="bg-amber-100 rounded-full p-4 mb-4">
              <AlertTriangle className="h-12 w-12 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {t('permissions.templateMissing.title', 'Modèle de permissions introuvable')}
            </h1>
            <p className="text-gray-600">
              {t('permissions.templateMissing.subtitle', 'Votre modèle de permissions n\'existe plus')}
            </p>
          </div>

          {/* Company Info */}
          {company && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-3">
                <Building2 className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-blue-900 mb-1">
                    {t('permissions.templateMissing.company', 'Entreprise')}
                  </p>
                  <p className="text-sm text-blue-800">{company.name}</p>
                </div>
              </div>
            </div>
          )}

          {/* Message */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
            <p className="text-gray-700 leading-relaxed mb-4">
              {t(
                'permissions.templateMissing.message',
                'Le modèle de permissions qui vous était attribué a été supprimé. Pour continuer à utiliser les services Geskap, vous devez contacter le propriétaire ou l\'administrateur de l\'entreprise pour obtenir de nouvelles permissions.'
              )}
            </p>
            <p className="text-sm text-gray-600">
              {t(
                'permissions.templateMissing.instruction',
                'Une fois que de nouvelles permissions vous seront attribuées, vous pourrez accéder à nouveau à votre tableau de bord.'
              )}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              variant="outline"
              onClick={handleGoBack}
              className="inline-flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4 flex-shrink-0" />
              <span className="whitespace-nowrap">
                {t('permissions.templateMissing.backToCompanies', 'Retour aux entreprises')}
              </span>
            </Button>
            <Button
              variant="secondary"
              onClick={handleSignOut}
              className="inline-flex items-center gap-2"
            >
              <LogOut className="h-4 w-4 flex-shrink-0" />
              <span className="whitespace-nowrap">{t('permissions.templateMissing.signOut', 'Se déconnecter')}</span>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PermissionTemplateMissing;


