import { Suspense, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import LoadingScreen from './components/common/LoadingScreen';
import { Toaster } from 'react-hot-toast';
import { PWAErrorHandler, PWAUpdateNotification } from './components/pwa';
import { AppRoutes } from './router';

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
        <Toaster 
          containerStyle={{
            zIndex: 9999, // Highest z-index to ensure toasts appear above all other elements
          }}
          toastOptions={{
            style: {
              zIndex: 9999, // Highest z-index for individual toasts
            },
          }}
        />
        <PWAUpdateNotification />
        
        <AppRoutes 
          isAddSaleModalOpen={isAddSaleModalOpen} 
          setIsAddSaleModalOpen={setIsAddSaleModalOpen} 
        />
      </Suspense>
    </PWAErrorHandler>
  );
}

export default App;