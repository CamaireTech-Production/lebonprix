import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const AuthLayout = () => {
  const { t } = useTranslation();

  // Use default colors for auth pages (user is not authenticated yet)
  const colors = {
    primary: '#183524',
    secondary: '#e2b069',
    tertiary: '#2a4a3a'
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          <span style={{color: colors.primary}}>Geskap</span>
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {t('auth.internalSystem')}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;