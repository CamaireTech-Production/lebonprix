import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import LanguageSwitcher from '@components/common/LanguageSwitcher';
import { Building2, ArrowLeft, Info, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PendingInvitationsBanner from '@components/invitations/PendingInvitationsBanner';
import { CompanyForm } from '@components/company/CompanyForm';

export default function CreateCompany() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [showNewUserMessage, setShowNewUserMessage] = useState(searchParams.get('new_user') === 'true');

  const handleSuccess = (companyId: string) => {
    navigate(`/company/${companyId}/dashboard`);
  };

  const handleCancel = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow relative">
        <div className="absolute top-2 right-4">
          <LanguageSwitcher />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center">
              {!showNewUserMessage && (
                <button
                  onClick={() => navigate(-1)}
                  className="mr-4 p-2 text-gray-400 hover:text-gray-600"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              )}
              <div className={`w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center ${showNewUserMessage ? 'mr-4' : ''}`}>
                <Building2 className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="ml-3">
                <h1 className="text-2xl font-bold text-gray-900">{t('company.create.title')}</h1>
                <p className="text-sm text-gray-500">{t('company.create.subtitle')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New User Message */}
      {showNewUserMessage && (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-md shadow-sm relative">
            <div className="flex">
              <div className="flex-shrink-0">
                <Info className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3 pr-8">
                <h3 className="text-sm font-medium text-blue-800">{t('company.create.newUserMessage.title')}</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>
                    {t('company.create.newUserMessage.content')}
                  </p>
                </div>
              </div>
              <div className="absolute top-2 right-2">
                <button
                  type="button"
                  onClick={() => setShowNewUserMessage(false)}
                  className="bg-blue-50 rounded-md p-1.5 inline-flex text-blue-500 hover:bg-blue-100 focus:outline-none"
                >
                  <span className="sr-only">{t('company.create.newUserMessage.close')}</span>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pending Invitations Banner */}
      {user?.email && (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          <PendingInvitationsBanner userEmail={user.email} />
        </div>
      )}

      {/* Use the shared CompanyForm component */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CompanyForm
          onSuccess={handleSuccess}
          onCancel={handleCancel}
          isModal={false}
        />
      </div>
    </div>
  );
}
