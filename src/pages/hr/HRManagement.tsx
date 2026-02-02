import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Legacy HRManagement component - redirects to permissions for backward compatibility
 * This component is kept for backward compatibility but redirects to the new permissions system
 */
const HRManagement: React.FC = () => {
  return <Navigate to="../permissions" replace />;
};

export default HRManagement;
