import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Legacy ExpensesPage - redirects to the new nested routing structure
 * Kept for backward compatibility
 */
const ExpensesPage = () => {
  // Redirect to the new nested routing structure
  return <Navigate to="/expenses/list" replace />;
};

export default ExpensesPage;
