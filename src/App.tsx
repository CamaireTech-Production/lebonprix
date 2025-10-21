import { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import AuthLayout from './components/layout/AuthLayout';
import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import RoleRoute from './components/auth/RoleRoute';
import LoadingScreen from './components/common/LoadingScreen';
import LazyPage from './components/common/LazyPage';
import { Toaster } from 'react-hot-toast';
import { FloatingActionButton } from './components/common/Button';
import AddSaleModal from './components/sales/AddSaleModal';
import Finance from './pages/Finance';
import { EnhancedPWAInstallPrompt } from './components/EnhancedPWAInstallPrompt';
import { PWAErrorHandler } from './components/PWAErrorHandler';
import { PWAUpdateNotification } from './components/PWAUpdateNotification';
import { usePWAUpdate } from './hooks/usePWAUpdate';

// Lazy load pages
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Sales = lazy(() => import('./pages/Sales'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Products = lazy(() => import('./pages/Products'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));
const TimelinePage = lazy(() => import('./pages/TimelinePage'));
const Catalogue = lazy(() => import('./pages/Catalogue'));
// ProductDetail removed - now using modal instead
const FIFODebugger = lazy(() => import('./pages/FIFODebugger'));
// Public invite/employee login pages
const InviteActivate = lazy(() => import('./pages/InviteActivate'));
const EmployeeLogin = lazy(() => import('./pages/EmployeeLogin'));

function App() {
  const [isAddSaleModalOpen, setIsAddSaleModalOpen] = useState(false);
  // BrowserRouter must wrap AppWithFAB for useLocation to work
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <AppWithFAB isAddSaleModalOpen={isAddSaleModalOpen} setIsAddSaleModalOpen={setIsAddSaleModalOpen} />
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}

function AppWithFAB({ isAddSaleModalOpen, setIsAddSaleModalOpen }: { isAddSaleModalOpen: boolean, setIsAddSaleModalOpen: (open: boolean) => void }) {
  const location = useLocation();
  const { isUpdateAvailable, applyUpdate, dismissUpdate } = usePWAUpdate();
  const isAuthPage = location.pathname.startsWith('/auth/login') || location.pathname.startsWith('/auth/register');
  const isCataloguePage = /^\/catalogue\/[^/]+\/[^/]+$/.test(location.pathname);
  // ProductDetail page removed - now using modal
  const isTrackSalesPage = location.pathname.startsWith('/track/');
  
  return (
    <PWAErrorHandler>
      <Suspense fallback={<LoadingScreen />}>
        <Toaster />
        
        {/* PWA Update Notification */}
        {isUpdateAvailable && (
          <PWAUpdateNotification
            onUpdate={applyUpdate}
            onDismiss={dismissUpdate}
          />
        )}
        
        <Routes>
          {/* Auth Routes */}
          <Route element={<AuthLayout />}>
            <Route path="/auth/login" element={<LazyPage><Login /></LazyPage>} />
            <Route path="/auth/register" element={<LazyPage><Register /></LazyPage>} />
          </Route>
          {/* Public Routes */}
          <Route path="/track/:id" element={<LazyPage><TimelinePage /></LazyPage>} />
          <Route path="/catalogue/:companyName/:companyId" element={<LazyPage><Catalogue /></LazyPage>} />
          {/* ProductDetail route removed - now using modal */}
          {/* Public Invite Activation Route */}
          <Route path="/invite/:inviteId" element={<LazyPage><InviteActivate /></LazyPage>} />
          {/* Public Employee Login Route */}
          <Route path="/employee-login/:companyName/:companyId/:loginLink" element={<LazyPage><EmployeeLogin /></LazyPage>} />
          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout isAddSaleModalOpen={isAddSaleModalOpen} setIsAddSaleModalOpen={setIsAddSaleModalOpen} />}>
              <Route path="/" element={<LazyPage><Dashboard /></LazyPage>} />
              <Route path="/sales" element={<LazyPage><Sales /></LazyPage>} />
              <Route path="/expenses" element={<LazyPage><Expenses /></LazyPage>} />
              <Route path="/finance" element={<RoleRoute allowedRoles={['gestionnaire', 'magasinier', 'owner']}><Finance /></RoleRoute>} />
              <Route path="/products" element={<LazyPage><Products /></LazyPage>} />
              <Route path="/suppliers" element={<LazyPage><Suppliers /></LazyPage>} />
              <Route path="/reports" element={<RoleRoute allowedRoles={['gestionnaire', 'magasinier', 'owner']}><LazyPage><Reports /></LazyPage></RoleRoute>} />
              <Route path="/settings" element={<RoleRoute allowedRoles={['magasinier', 'owner']}><LazyPage><Settings /></LazyPage></RoleRoute>} />
              <Route path="/fifo-debugger" element={<LazyPage><FIFODebugger /></LazyPage>} />
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