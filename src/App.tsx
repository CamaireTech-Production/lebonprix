import { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import AuthLayout from './components/layout/AuthLayout';
import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import RoleRoute from './components/auth/RoleRoute';
import LoadingScreen from './components/common/LoadingScreen';
import LazyPage from './components/common/LazyPage';
import { Toaster } from 'react-hot-toast';
import Finance from './pages/Finance';
import { PWAErrorHandler } from './components/PWAErrorHandler';

// Lazy load pages
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const ModeSelection = lazy(() => import('./pages/ModeSelection'));
const CompaniesManagement = lazy(() => import('./pages/CompaniesManagement'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Sales = lazy(() => import('./pages/Sales'));
const Orders = lazy(() => import('./pages/Orders'));
const Expenses = lazy(() => import('./pages/Expenses'));
const ExpensesList = lazy(() => import('./pages/expenses/ExpensesList'));
const ExpensesCategories = lazy(() => import('./pages/expenses/ExpensesCategories'));
const ExpensesAnalytics = lazy(() => import('./pages/expenses/ExpensesAnalytics'));
const ExpensesReports = lazy(() => import('./pages/expenses/ExpensesReports'));
const Products = lazy(() => import('./pages/Products'));
const Categories = lazy(() => import('./pages/Categories'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));
const Profile = lazy(() => import('./pages/Profile'));
const TimelinePage = lazy(() => import('./pages/TimelinePage'));
const Catalogue = lazy(() => import('./pages/Catalogue'));
const SingleCheckout = lazy(() => import('./pages/SingleCheckout'));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'));
// ProductDetail removed - now using modal instead
const FIFODebugger = lazy(() => import('./pages/FIFODebugger'));
// Public invite/employee login pages
const InviteActivate = lazy(() => import('./pages/InviteActivate'));
const EmployeeLogin = lazy(() => import('./pages/EmployeeLogin'));
// New pages for employee/company modes
const CreateCompany = lazy(() => import('./pages/company/CreateCompany'));
const CompanySelection = lazy(() => import('./pages/company/CompanySelection'));
const HRManagement = lazy(() => import('./pages/HRManagement'));
const EmployeeDashboard = lazy(() => import('./pages/EmployeeDashboard'));

function App() {
  const [isAddSaleModalOpen, setIsAddSaleModalOpen] = useState(false);
  // BrowserRouter must wrap AuthProvider for useNavigate to work
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <AppWithFAB isAddSaleModalOpen={isAddSaleModalOpen} setIsAddSaleModalOpen={setIsAddSaleModalOpen} />
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

function AppWithFAB({ isAddSaleModalOpen, setIsAddSaleModalOpen }: { isAddSaleModalOpen: boolean, setIsAddSaleModalOpen: (open: boolean) => void }) {
  return (
    <PWAErrorHandler>
      <Suspense fallback={<LoadingScreen />}>
        <Toaster />
        
        <Routes>
          {/* Root redirect to login */}
          <Route path="/" element={<Navigate to="/auth/login" replace />} />
          
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
          {/* ProductDetail route removed - now using modal */}
          {/* Public Invite Activation Route */}
          <Route path="/invite/:inviteId" element={<LazyPage><InviteActivate /></LazyPage>} />
          {/* Public Employee Login Route */}
          <Route path="/employee-login/:companyName/:companyId/:loginLink" element={<LazyPage><EmployeeLogin /></LazyPage>} />
          
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
              <Route path="orders" element={<LazyPage><Orders /></LazyPage>} />
              <Route path="expenses" element={<Navigate to="expenses/list" replace />} />
              <Route path="expenses/list" element={<LazyPage><ExpensesList /></LazyPage>} />
              <Route path="expenses/categories" element={<LazyPage><ExpensesCategories /></LazyPage>} />
              <Route path="expenses/analytics" element={<LazyPage><ExpensesAnalytics /></LazyPage>} />
              <Route path="expenses/reports" element={<LazyPage><ExpensesReports /></LazyPage>} />
              <Route path="finance" element={<RoleRoute allowedRoles={['gestionnaire', 'magasinier', 'owner']}><Finance /></RoleRoute>} />
              <Route path="products" element={<LazyPage><Products /></LazyPage>} />
              <Route path="categories" element={<LazyPage><Categories /></LazyPage>} />
              <Route path="suppliers" element={<LazyPage><Suppliers /></LazyPage>} />
              <Route path="hr" element={<RoleRoute allowedRoles={['magasinier', 'owner']}><LazyPage><HRManagement /></LazyPage></RoleRoute>} />
              <Route path="reports" element={<RoleRoute allowedRoles={['gestionnaire', 'magasinier', 'owner']}><LazyPage><Reports /></LazyPage></RoleRoute>} />
              <Route path="profile" element={<LazyPage><Profile /></LazyPage>} />
              <Route path="settings" element={<RoleRoute allowedRoles={['magasinier', 'owner']}><LazyPage><Settings /></LazyPage></RoleRoute>} />
              <Route path="fifo-debugger" element={<LazyPage><FIFODebugger /></LazyPage>} />
            </Route>
          </Route>
          {/* Redirect to login if no route matches */}
          <Route path="*" element={<Navigate to="/auth/login" replace />} />
        </Routes>
      </Suspense>
    </PWAErrorHandler>
  );
}

export default App;