import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AuthLayout from './components/layout/AuthLayout';
import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoadingScreen from './components/common/LoadingScreen';
import { Toaster } from 'react-hot-toast';

// Lazy load pages
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Sales = lazy(() => import('./pages/Sales'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Products = lazy(() => import('./pages/Products'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));
const TimelinePage = lazy(() => import('./pages/TimelinePage'));
const CompanyProducts = lazy(() => import('./pages/CompanyProducts'));

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<LoadingScreen />}>
          <Toaster />
          <Routes>
            {/* Auth Routes */}
            <Route element={<AuthLayout />}>
              <Route path="/auth/login" element={<Login />} />
              <Route path="/auth/register" element={<Register />} />
            </Route>
            
            {/* Public Routes */}
            <Route path="/track/:id" element={<TimelinePage />} />
            <Route path="/company/:companyId/products" element={<CompanyProducts />} />

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<MainLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/sales" element={<Sales />} />
                <Route path="/expenses" element={<Expenses />} />
                <Route path="/products" element={<Products />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Route>
            
            {/* Redirect to login if no route matches */}
            <Route path="*" element={<Navigate to="/auth/login" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;