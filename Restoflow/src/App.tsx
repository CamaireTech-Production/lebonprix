import React from 'react';
import ColorPaletteEffect from './components/ui/ColorPaletteEffect';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { OfflineSyncProvider } from './contexts/OfflineSyncContext';
import designSystem from './designSystem';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { HelmetProvider } from 'react-helmet-async';
// Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ProfileSetup from './pages/auth/ProfileSetup';
import Settings from './pages/restaurant/Settings';
import Dashboard from './pages/restaurant/dashboard/Dashboard';
import MenuManagement from './pages/restaurant/menu/MenuManagement';
import CategoryManagement from './pages/restaurant/menu/CategoryManagement';
import TableManagement from './pages/restaurant/tables/TableManagement';
import OrdersPage from './pages/restaurant/orders/OrdersPage';
import MenuPage from './pages/client/customer/MenuPage';
import { Suspense } from 'react';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import CreateInitialAdmin from './pages/admin/CreateInitialAdmin';
import PublicOrderPage from './pages/client/public/PublicOrderPage';
import CheckoutPage from './pages/client/public/CheckoutPage';
import AdminRestaurants from './pages/admin/AdminRestaurants';
import AdminUsers from './pages/admin/AdminUsers';
import AdminMenus from './pages/admin/AdminMenus';
import AdminOrders from './pages/admin/AdminOrders';
import AdminActivityLog from './pages/admin/AdminActivityLog';
import MediaManagement from './pages/admin/MediaManagement';
import RestaurantDetail from './pages/admin/RestaurantDetail';
import RestaurantInspector from './pages/admin/RestaurantInspector';
import ContactsPage from './pages/restaurant/contacts/ContactsPage';
import { CustomersPage } from './pages/restaurant/customers';
import { ExpensesLayout, ExpensesList, ExpensesCategories, ExpensesAnalytics } from './pages/restaurant/expenses';
import { POSPage } from './pages/restaurant/pos';
import { InventoryLayout, IngredientsPage, InventoryCategoriesPage, StocksPage } from './pages/restaurant/inventory';
import { SuppliersPage } from './pages/restaurant/suppliers';
import { StaffLayout, StaffPage, PermissionsPage } from './pages/restaurant/staff';
import { ReportsPage } from './pages/restaurant/reports';
import ResetPassword from './pages/auth/ResetPassword';
import DeliveryManagement from './pages/restaurant/delivery/DeliveryManagement';
import AdsManagementFast from './pages/restaurant/ads/AdsManagementFast';
import VersionInfo from './pages/admin/VersionInfo';
// PWA Components
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { PWAStatusIndicator } from './components/PWAStatusIndicator';
import { PWAUpdateNotification } from './components/PWAUpdateNotification';
const CustomerOrdersPage = React.lazy(() => import('./pages/client/customer/OrdersPage'));
// Components
import ProtectedRoute from './components/auth/ProtectedRoute';
import VerificationWrapper from './components/auth/VerificationWrapper';
import TableSelection from './components/tables/TableSelection';
import PublicMenuPage from './pages/client/public/PublicMenuPage';
import PublicDailyMenuPage from './pages/client/public/PublicDailyMenuPage';
import AdminProtectedRoute from './components/auth/AdminProtectedRoute';

function App() {
  return (
    <HelmetProvider>
      <LanguageProvider>
        <Router>
          <AuthProvider>
            <OfflineSyncProvider>
              <AdminAuthProvider>
              <ColorPaletteEffect />
              <Routes>
                <Route path="/public-menu/:restaurantId" element={<PublicMenuPage />} />
                <Route path="/public-daily-menu/:restaurantId" element={<PublicDailyMenuPage />} />
                <Route path="/public-order/:restaurantId" element={<PublicOrderPage />} />
                <Route path="/public-order/:restaurantId/checkout" element={<CheckoutPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/newRestaurant" element={<Register />} />
                <Route 
                  path="/profile-setup" 
                  element={
                    <ProtectedRoute>
                      <VerificationWrapper>
                        <ProfileSetup key="profile-setup" />
                      </VerificationWrapper>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/settings" 
                  element={
                    <ProtectedRoute>
                      <VerificationWrapper>
                        <Settings key="settings" />
                      </VerificationWrapper>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/dashboard" 
                  element={
                    <ProtectedRoute>
                      <VerificationWrapper>
                        <Dashboard />
                      </VerificationWrapper>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/menu-management" 
                  element={
                    <ProtectedRoute>
                      <VerificationWrapper>
                        <MenuManagement />
                      </VerificationWrapper>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/category-management" 
                  element={
                    <ProtectedRoute>
                      <VerificationWrapper>
                        <CategoryManagement />
                      </VerificationWrapper>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/delivery-management" 
                  element={
                    <ProtectedRoute>
                      <VerificationWrapper>
                        <DeliveryManagement />
                      </VerificationWrapper>
                    </ProtectedRoute>
                  } 
                />
        <Route
          path="/ads-management"
          element={
            <ProtectedRoute>
              <VerificationWrapper>
                <AdsManagementFast />
              </VerificationWrapper>
            </ProtectedRoute>
          }
        />
                <Route 
                  path="/table-management" 
                  element={
                    <ProtectedRoute>
                      <VerificationWrapper>
                        <TableManagement />
                      </VerificationWrapper>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/orders" 
                  element={
                    <ProtectedRoute>
                      <VerificationWrapper>
                        <OrdersPage />
                      </VerificationWrapper>
                    </ProtectedRoute>
                  } 
                />
                <Route
                  path="/customer/orders/:tableNumber"
                  element={
                    <Suspense fallback={<div>Loading...</div>}>
                      <CustomerOrdersPage />
                    </Suspense>
                  }
                />
                <Route path="/table-selection" element={<TableSelection />} />
                <Route path="/menu/:restaurantId" element={<MenuPage />} />
                <Route path="/admin/create-initial" element={<CreateInitialAdmin />} />
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route
                  path="/admin/dashboard"
                  element={
                    <AdminProtectedRoute>
                      <AdminDashboard />
                    </AdminProtectedRoute>
                  }
                />
                <Route
                  path="/admin/restaurants"
                  element={
                    <AdminProtectedRoute>
                      <AdminRestaurants />
                    </AdminProtectedRoute>
                  }
                />
                <Route
                  path="/admin/restaurants/:id"
                  element={
                    <AdminProtectedRoute>
                      <RestaurantDetail />
                    </AdminProtectedRoute>
                  }
                />
                <Route
                  path="/admin/users"
                  element={
                    <AdminProtectedRoute>
                      <AdminUsers />
                    </AdminProtectedRoute>
                  }
                />
                <Route
                  path="/admin/menus"
                  element={
                    <AdminProtectedRoute>
                      <AdminMenus />
                    </AdminProtectedRoute>
                  }
                />
                <Route
                  path="/admin/orders"
                  element={
                    <AdminProtectedRoute>
                      <AdminOrders />
                    </AdminProtectedRoute>
                  }
                />
                <Route
                  path="/admin/media-management"
                  element={
                    <AdminProtectedRoute>
                      <MediaManagement />
                    </AdminProtectedRoute>
                  }
                />
                <Route
                  path="/admin/activity-log"
                  element={
                    <AdminProtectedRoute>
                      <AdminActivityLog />
                    </AdminProtectedRoute>
                  }
                />
                <Route
                  path="/admin/restaurant-inspector"
                  element={
                    <AdminProtectedRoute>
                      <RestaurantInspector />
                    </AdminProtectedRoute>
                  }
                />
                <Route
                  path="/admin/version-info"
                  element={
                    <AdminProtectedRoute>
                      <VersionInfo />
                    </AdminProtectedRoute>
                  }
                />
                <Route path="/contacts" element={<ContactsPage />} />
                <Route
                  path="/customers"
                  element={
                    <ProtectedRoute>
                      <VerificationWrapper>
                        <CustomersPage />
                      </VerificationWrapper>
                    </ProtectedRoute>
                  }
                />
                {/* Expenses Routes with nested layout */}
                <Route
                  path="/expenses"
                  element={
                    <ProtectedRoute>
                      <VerificationWrapper>
                        <ExpensesLayout />
                      </VerificationWrapper>
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="/expenses/list" replace />} />
                  <Route path="list" element={<ExpensesList />} />
                  <Route path="categories" element={<ExpensesCategories />} />
                  <Route path="analytics" element={<ExpensesAnalytics />} />
                </Route>
                {/* POS Route */}
                <Route
                  path="/pos"
                  element={
                    <ProtectedRoute>
                      <VerificationWrapper>
                        <POSPage />
                      </VerificationWrapper>
                    </ProtectedRoute>
                  }
                />
                {/* Inventory Routes with nested layout */}
                <Route
                  path="/inventory"
                  element={
                    <ProtectedRoute>
                      <VerificationWrapper>
                        <InventoryLayout />
                      </VerificationWrapper>
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="/inventory/ingredients" replace />} />
                  <Route path="ingredients" element={<IngredientsPage />} />
                  <Route path="categories" element={<InventoryCategoriesPage />} />
                  <Route path="stocks" element={<StocksPage />} />
                </Route>
                {/* Suppliers Route */}
                <Route
                  path="/suppliers"
                  element={
                    <ProtectedRoute>
                      <VerificationWrapper>
                        <SuppliersPage />
                      </VerificationWrapper>
                    </ProtectedRoute>
                  }
                />
                {/* Staff Routes with nested layout */}
                <Route
                  path="/staff"
                  element={
                    <ProtectedRoute>
                      <VerificationWrapper>
                        <StaffLayout />
                      </VerificationWrapper>
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<StaffPage />} />
                  <Route path="permissions" element={<PermissionsPage />} />
                </Route>
                {/* Reports Route */}
                <Route
                  path="/reports"
                  element={
                    <ProtectedRoute>
                      <VerificationWrapper>
                        <ReportsPage />
                      </VerificationWrapper>
                    </ProtectedRoute>
                  }
                />
                {/* Default routes */}
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 3000,
                  style: {
                    background: designSystem.colors.white,
                    color: designSystem.colors.text,
                    border: `1px solid ${designSystem.colors.borderLightGray}`,
                    fontWeight: 500,
                  },
                  success: {
                    style: {
                      background: designSystem.colors.success,
                      color: designSystem.colors.textInverse,
                    },
                  },
                  error: {
                    style: {
                      background: designSystem.colors.error,
                      color: designSystem.colors.textInverse,
                    },
                  },
                }}
              />
              </AdminAuthProvider>
            </OfflineSyncProvider>
          </AuthProvider>
          
          {/* PWA Components */}
          <PWAInstallPrompt />
          <PWAStatusIndicator />
          <PWAUpdateNotification />
        </Router>
      </LanguageProvider>
    </HelmetProvider>
  );
}

export default App;