import { POSScreen } from '../../components/pos/POSScreen';
import { LoadingScreen } from '@components/common';
import { useAuth } from '@contexts/AuthContext';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useShops } from '@hooks/data/useFirestore';
import { getDefaultShop } from '@services/firestore/shops/shopService';

const POS = () => {
  const { user, company, loading } = useAuth();
  const navigate = useNavigate();
  const { companyId, shopId } = useParams<{ companyId: string; shopId?: string }>();
  const { shops } = useShops();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth/login');
    }
  }, [user, loading, navigate]);

  // Auto-redirect to default shop if only one shop exists and no shopId in URL
  useEffect(() => {
    if (!loading && company?.id && !shopId && shops && shops.length === 1) {
      const defaultShop = shops[0];
      if (defaultShop) {
        navigate(`/company/${companyId}/pos/shop/${defaultShop.id}`, { replace: true });
      }
    } else if (!loading && company?.id && !shopId && shops && shops.length > 1) {
      // If multiple shops, try to get default shop
      const initializeDefaultShop = async () => {
        try {
          const defaultShop = await getDefaultShop(company.id);
          if (defaultShop) {
            navigate(`/company/${companyId}/pos/shop/${defaultShop.id}`, { replace: true });
          }
        } catch (error) {
          // If no default shop, stay on general POS
        }
      };
      initializeDefaultShop();
    }
  }, [loading, company?.id, shopId, shops, companyId, navigate]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user || !company) {
    return null;
  }

  return <POSScreen />;
};

export default POS;

