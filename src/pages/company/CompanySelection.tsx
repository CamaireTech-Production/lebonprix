import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingScreen from '../../components/common/LoadingScreen';

/**
 * CompanySelection Component - Redirects to new Employee Dashboard
 * 
 * This component is kept for backward compatibility but now redirects
 * users to the new Employee Dashboard at /employee/dashboard
 */
const CompanySelection: React.FC = () => {
  const navigate = useNavigate();

  // Redirect to new employee dashboard
  useEffect(() => {
    navigate('/employee/dashboard', { replace: true });
  }, [navigate]);

  // Return loading screen while redirecting
  return <LoadingScreen />;
};

export default CompanySelection;