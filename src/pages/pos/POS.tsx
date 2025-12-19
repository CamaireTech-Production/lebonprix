import { POSScreen } from '../components/pos/POSScreen';
import { LoadingScreen } from '@components/common';
import { useAuth } from '@contexts/AuthContext';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const POS = () => {
  const { user, company, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth/login');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user || !company) {
    return null;
  }

  return <POSScreen />;
};

export default POS;

