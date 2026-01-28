import { Suspense, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { PWAProvider } from './contexts/PWAContext';
import { StockMonitoringProvider } from './components/notifications/StockMonitoringProvider';
import SkeletonAppLoading from './components/common/SkeletonAppLoading';
import { Toaster } from 'react-hot-toast';
import { PWAErrorHandler, PWAUpdateNotification, ErrorBoundary } from './components/pwa';
import { AppRoutes } from './router';
import FirebaseReadMonitor from './components/monitoring/FirebaseReadMonitor';

function App() {
  const [isAddSaleModalOpen, setIsAddSaleModalOpen] = useState(false);
  // BrowserRouter must wrap AuthProvider for useNavigate to work
  return (
    <BrowserRouter>
      <AuthProvider>
        <StockMonitoringProvider>
          <CartProvider>
            <PWAProvider>
              <AppWithFAB isAddSaleModalOpen={isAddSaleModalOpen} setIsAddSaleModalOpen={setIsAddSaleModalOpen} />
            </PWAProvider>
          </CartProvider>
        </StockMonitoringProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

function AppWithFAB({ isAddSaleModalOpen, setIsAddSaleModalOpen }: { isAddSaleModalOpen: boolean, setIsAddSaleModalOpen: (open: boolean) => void }) {
  return (
    <ErrorBoundary>
      <PWAErrorHandler>
        <Suspense fallback={<SkeletonAppLoading />}>
          <Toaster 
            containerStyle={{
              zIndex: 10000, // Higher than modals (z-[9999]) to ensure toasts appear above everything
            }}
            toastOptions={{
              style: {
                zIndex: 10000, // Higher than modals for individual toasts
              },
            }}
          />
          <PWAUpdateNotification />
          
          <AppRoutes 
            isAddSaleModalOpen={isAddSaleModalOpen} 
            setIsAddSaleModalOpen={setIsAddSaleModalOpen} 
          />
          <FirebaseReadMonitor />
        </Suspense>
      </PWAErrorHandler>
    </ErrorBoundary>
  );
}

export default App;
