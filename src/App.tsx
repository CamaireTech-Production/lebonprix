import { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AuthLayout from './components/layout/AuthLayout';
import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoadingScreen from './components/common/LoadingScreen';
import LazyPage from './components/common/LazyPage';
import { Toaster } from 'react-hot-toast';
import { FloatingActionButton } from './components/common/Button';
import AddSaleModal from './components/sales/AddSaleModal';
import Finance from './pages/Finance';
import { EnhancedPWAInstallPrompt } from './components/EnhancedPWAInstallPrompt';
import { PWAStatusIndicator } from './components/PWAStatusIndicator';

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
const FIFODebugger = lazy(() => import('./pages/FIFODebugger'));

function App() {
  const [isAddSaleModalOpen, setIsAddSaleModalOpen] = useState(false);
  // BrowserRouter must wrap AppWithFAB for useLocation to work
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppWithFAB isAddSaleModalOpen={isAddSaleModalOpen} setIsAddSaleModalOpen={setIsAddSaleModalOpen} />
      </BrowserRouter>
    </AuthProvider>
  );
}

function AppWithFAB({ isAddSaleModalOpen, setIsAddSaleModalOpen }: { isAddSaleModalOpen: boolean, setIsAddSaleModalOpen: (open: boolean) => void }) {
  const location = useLocation();
  const isAuthPage = location.pathname.startsWith('/auth/login') || location.pathname.startsWith('/auth/register');
  const isCataloguePage = /^\/catalogue\/[^/]+\/[^/]+$/.test(location.pathname);
  const isTrackSalesPage = location.pathname.startsWith('/track/');
  return (
    <>
      {!isAuthPage && !isCataloguePage && !isTrackSalesPage && (
        <FloatingActionButton onClick={() => setIsAddSaleModalOpen(true)} label="Add Sale" />
      )}
      <AddSaleModal isOpen={isAddSaleModalOpen} onClose={() => setIsAddSaleModalOpen(false)} />
      
      {/* PWA Components */}
      <PWAStatusIndicator />
      
      <Suspense fallback={<LoadingScreen />}>
        <Toaster />
        <Routes>
          {/* Auth Routes */}
          <Route element={<AuthLayout />}>
            <Route path="/auth/login" element={<LazyPage><Login /></LazyPage>} />
            <Route path="/auth/register" element={<LazyPage><Register /></LazyPage>} />
          </Route>
          {/* Public Routes */}
          <Route path="/track/:id" element={<LazyPage><TimelinePage /></LazyPage>} />
          <Route path="/catalogue/:companyName/:companyId" element={<LazyPage><Catalogue /></LazyPage>} />
          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/" element={<LazyPage><Dashboard /></LazyPage>} />
              <Route path="/sales" element={<LazyPage><Sales /></LazyPage>} />
              <Route path="/expenses" element={<LazyPage><Expenses /></LazyPage>} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/products" element={<LazyPage><Products /></LazyPage>} />
              <Route path="/suppliers" element={<LazyPage><Suppliers /></LazyPage>} />
              <Route path="/reports" element={<LazyPage><Reports /></LazyPage>} />
              <Route path="/settings" element={<LazyPage><Settings /></LazyPage>} />
              <Route path="/fifo-debugger" element={<LazyPage><FIFODebugger /></LazyPage>} />
            </Route>
          </Route>
          {/* Redirect to login if no route matches */}
          <Route path="*" element={<Navigate to="/auth/login" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default App;