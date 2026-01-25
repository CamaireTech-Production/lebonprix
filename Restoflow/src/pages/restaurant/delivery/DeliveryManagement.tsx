import React from 'react';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import { useAuth } from '../../../contexts/AuthContext';
import DeliveryManagementContent from '../../../shared/DeliveryManagementContent';

const DeliveryManagement: React.FC = () => {
  const { restaurant, updateRestaurantProfile } = useAuth();

  return (
    <DashboardLayout title="">
      <DeliveryManagementContent
        restaurant={restaurant}
        updateRestaurantProfile={updateRestaurantProfile}
        isDemoUser={false}
      />
    </DashboardLayout>
  );
};

export default DeliveryManagement; 