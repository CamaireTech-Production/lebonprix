import React, { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthLayout, MainLayout } from '@components/layout';
import { ProtectedRoute, RoleRoute } from '@components/auth';
import { LazyPage } from '@components/common';
import Finance from '@pages/finance/Finance';
import { RESOURCES } from '@constants/resources';

// Lazy load pages
const Login = lazy(() => import('../pages/auth/Login'));
const Register = lazy(() => import('../pages/auth/Register'));
const ModeSelection = lazy(() => import('../pages/onboarding/ModeSelection'));
const CompaniesManagement = lazy(() => import('../pages/company/CompaniesManagement'));
const Dashboard = lazy(() => import('../pages/dashboard/Dashboard'));
const Sales = lazy(() => import('../pages/sales/Sales'));
const POS = lazy(() => import('../pages/pos/POS'));
const Orders = lazy(() => import('../pages/orders/Orders'));
const ExpensesList = lazy(() => import('../pages/expenses/ExpensesList'));
const ExpensesCategories = lazy(() => import('../pages/expenses/ExpensesCategories'));
const ExpensesAnalytics = lazy(() => import('../pages/expenses/ExpensesAnalytics'));
const ExpensesReports = lazy(() => import('../pages/expenses/ExpensesReports'));
const Products = lazy(() => import('../pages/products/Products'));
const Stocks = lazy(() => import('../pages/products/Stocks'));
const Categories = lazy(() => import('../pages/categories/Categories'));
const Magasin = lazy(() => import('../pages/magasin/Magasin'));
const MagasinMatieres = lazy(() => import('../pages/magasin/Matieres'));
const MagasinCategories = lazy(() => import('../pages/magasin/Categories'));
const MagasinStocks = lazy(() => import('../pages/magasin/Stocks'));
const Suppliers = lazy(() => import('../pages/suppliers/Suppliers'));
const Contacts = lazy(() => import('../pages/customers/Contacts'));
const CustomerSources = lazy(() => import('../pages/customers/CustomerSources'));
const Reports = lazy(() => import('../pages/reports/Reports'));
const Settings = lazy(() => import('../pages/settings/Settings'));
const Profile = lazy(() => import('../pages/hr/Profile'));
const TimelinePage = lazy(() => import('../pages/orders/TimelinePage'));
const Catalogue = lazy(() => import('../pages/products/Catalogue'));
const SingleCheckout = lazy(() => import('../pages/orders/SingleCheckout'));
const ProductDetailPage = lazy(() => import('../pages/products/ProductDetailPage'));
const InviteActivate = lazy(() => import('../pages/invite/InviteActivate'));
const CreateCompany = lazy(() => import('../pages/company/CreateCompany'));
const CompanySelection = lazy(() => import('../pages/company/CompanySelection'));
const HRManagement = lazy(() => import('../pages/hr/HRManagement'));
const EmployeeDashboard = lazy(() => import('../pages/dashboard/EmployeeDashboard'));
const Productions = lazy(() => import('../pages/productions/Productions'));
const ProductionFlowSteps = lazy(() => import('../pages/productions/FlowSteps'));
const ProductionFlows = lazy(() => import('../pages/productions/Flows'));
const ProductionCategories = lazy(() => import('../pages/productions/Categories'));
const ProductionDetail = lazy(() => import('../pages/productions/ProductionDetail'));
const Charges = lazy(() => import('../pages/productions/Charges'));
const Site = lazy(() => import('../pages/site/Site'));

interface AppRoutesProps {
  isAddSaleModalOpen: boolean;
  setIsAddSaleModalOpen: (open: boolean) => void;
}

export const AppRoutes: React.FC<AppRoutesProps> = ({ isAddSaleModalOpen, setIsAddSaleModalOpen }) => {
  return (
    <Routes>
      {/* Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/auth/login" element={<LazyPage><Login /></LazyPage>} />
        <Route path="/auth/register" element={<LazyPage><Register /></LazyPage>} />
      </Route>
      
      {/* Mode Selection Route */}
      <Route path="/mode-selection" element={<LazyPage><ModeSelection /></LazyPage>} />
    
      {/* Public Routes */}
      <Route path="/track/:id" element={<LazyPage><TimelinePage /></LazyPage>} />
      <Route path="/catalogue/:companyName/:companyId" element={<LazyPage><Catalogue /></LazyPage>} />
      <Route path="/catalogue/:companyName/:companyId/product/:productId" element={<LazyPage><ProductDetailPage /></LazyPage>} />
      <Route path="/checkout" element={<LazyPage><SingleCheckout /></LazyPage>} />
      {/* Public Invite Activation Route - Redirects to login for backward compatibility */}
      <Route path="/invite/:inviteId" element={<LazyPage><InviteActivate /></LazyPage>} />
      
      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        {/* Employee Dashboard Route */}
        <Route path="/employee/dashboard" element={<LazyPage><EmployeeDashboard /></LazyPage>} />
        
        {/* Company Selection Route */}
        <Route path="/companies/me/:userId" element={<LazyPage><CompanySelection /></LazyPage>} />
        
        {/* Company Routes */}
        <Route path="/company/create" element={<LazyPage><CreateCompany /></LazyPage>} />
        
        {/* Company Management Routes */}
        <Route path="/companies" element={<LazyPage><CompaniesManagement /></LazyPage>} />
        
        {/* Routes entreprise spécifique */}
        <Route path="/company/:companyId" element={<MainLayout isAddSaleModalOpen={isAddSaleModalOpen} setIsAddSaleModalOpen={setIsAddSaleModalOpen} />}>
          <Route path="dashboard" element={<LazyPage><Dashboard /></LazyPage>} />
          <Route path="sales" element={<LazyPage><Sales /></LazyPage>} />
          <Route path="pos" element={<RoleRoute requiredResource="sales"><LazyPage><POS /></LazyPage></RoleRoute>} />
          <Route path="orders" element={<LazyPage><Orders /></LazyPage>} />
          <Route path="expenses" element={<Navigate to="expenses/list" replace />} />
          <Route path="expenses/list" element={<LazyPage><ExpensesList /></LazyPage>} />
          <Route path="expenses/categories" element={<LazyPage><ExpensesCategories /></LazyPage>} />
          <Route path="expenses/analytics" element={<LazyPage><ExpensesAnalytics /></LazyPage>} />
          <Route path="expenses/reports" element={<LazyPage><ExpensesReports /></LazyPage>} />
          <Route path="finance" element={<RoleRoute requiredResource="finance"><Finance /></RoleRoute>} />
          <Route path="products" element={<LazyPage><Products /></LazyPage>} />
          <Route path="products/stocks" element={<LazyPage><Stocks /></LazyPage>} />
          <Route path="categories" element={<LazyPage><Categories /></LazyPage>} />
          <Route path="productions" element={<LazyPage><Productions /></LazyPage>} />
          <Route path="productions/:id" element={<LazyPage><ProductionDetail /></LazyPage>} />
          <Route path="productions/categories" element={<LazyPage><ProductionCategories /></LazyPage>} />
          <Route path="productions/flow-steps" element={<LazyPage><ProductionFlowSteps /></LazyPage>} />
          <Route path="productions/flows" element={<LazyPage><ProductionFlows /></LazyPage>} />
          <Route path="productions/charges" element={<LazyPage><Charges /></LazyPage>} />
          <Route path="magasin" element={<Navigate to="magasin/matieres" replace />} />
          <Route path="magasin/matieres" element={<RoleRoute requiredResource={RESOURCES.MAGASIN}><LazyPage><MagasinMatieres /></LazyPage></RoleRoute>} />
          <Route path="magasin/categories" element={<RoleRoute requiredResource={RESOURCES.MAGASIN}><LazyPage><MagasinCategories /></LazyPage></RoleRoute>} />
          <Route path="magasin/stocks" element={<RoleRoute requiredResource={RESOURCES.MAGASIN}><LazyPage><MagasinStocks /></LazyPage></RoleRoute>} />
          <Route path="suppliers" element={<LazyPage><Suppliers /></LazyPage>} />
          <Route path="contacts" element={<RoleRoute requiredResource="customers"><LazyPage><Contacts /></LazyPage></RoleRoute>} />
          <Route path="contacts/sources" element={<RoleRoute requiredResource="customers"><LazyPage><CustomerSources /></LazyPage></RoleRoute>} />
          <Route path="hr" element={<RoleRoute requiredResource="hr"><LazyPage><HRManagement /></LazyPage></RoleRoute>} />
          <Route path="reports" element={<RoleRoute requiredResource="reports"><LazyPage><Reports /></LazyPage></RoleRoute>} />
          <Route path="profile" element={<LazyPage><Profile /></LazyPage>} />
          <Route path="site" element={<RoleRoute requiredResource="settings"><LazyPage><Site /></LazyPage></RoleRoute>} />
          <Route path="settings" element={<RoleRoute requiredResource="settings"><LazyPage><Settings /></LazyPage></RoleRoute>} />
        </Route>
      </Route>
      {/* Redirect to login if no route matches */}
      <Route path="*" element={<Navigate to="/auth/login" replace />} />
    </Routes>
  );
};

