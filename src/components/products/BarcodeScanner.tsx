import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { showErrorToast, showSuccessToast } from '../../utils/toast';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  companyName: string;
  companyId: string;
  onProductFound?: (productId: string) => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  isOpen,
  onClose,
  companyName,
  companyId,
  onProductFound
}) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Fonction helper pour arrêter le scanner de manière sécurisée
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (err: any) {
        // Vérifier si l'erreur est "scanner is not running" ou "not paused"
        if (err.message && 
            !err.message.includes('not running') && 
            !err.message.includes('not paused') &&
            !err.message.includes('Cannot stop')) {
          console.error('Erreur lors de l\'arrêt du scanner:', err);
        }
        // Ignorer les erreurs si le scanner n'est pas en cours d'exécution
      } finally {
        try {
          scannerRef.current.clear();
        } catch (err) {
          // Ignorer les erreurs de nettoyage
        }
        scannerRef.current = null;
      }
    }
  }, []);

  const handleBarcodeScanned = useCallback(async (barcode: string) => {
    try {
      // Arrêter le scanner de manière sécurisée
      await stopScanner();
      setIsScanning(false);

      // Vérifier si c'est une URL de produit
      const productUrlMatch = barcode.match(/\/catalogue\/[^/]+\/([^/]+)\/product\/([^/?]+)/);
      if (productUrlMatch) {
        const [, , productId] = productUrlMatch;
        if (onProductFound) {
          onProductFound(productId);
        } else {
          navigate(`/catalogue/${encodeURIComponent(companyName)}/${companyId}/product/${productId}`);
        }
        showSuccessToast('Produit trouvé !');
        onClose();
        return;
      }

      // Si c'est un code-barres EAN-13, chercher le produit par code-barres
      if (/^\d{13}$/.test(barcode)) {
        // Importer le service pour chercher le produit
        const { subscribeToProducts } = await import('../../services/firestore');
        
        // Chercher le produit avec ce code-barres
        const products = await new Promise<any[]>((resolve) => {
          const unsubscribe = subscribeToProducts(companyId, (products) => {
            unsubscribe();
            resolve(products);
          });
        });

        const product = products.find(p => p.barCode === barcode);
        if (product) {
          if (onProductFound) {
            onProductFound(product.id);
          } else {
            navigate(`/catalogue/${encodeURIComponent(companyName)}/${companyId}/product/${product.id}`);
          }
          showSuccessToast('Produit trouvé !');
          onClose();
        } else {
          showErrorToast('Produit non trouvé avec ce code-barres');
          // Redémarrer le scanner après un délai si le modal est toujours ouvert
          setTimeout(() => {
            if (isOpen && !scannerRef.current) {
              initScannerRef.current();
            }
          }, 2000);
        }
      } else {
        showErrorToast('Code-barres non reconnu');
        // Redémarrer le scanner après un délai si le modal est toujours ouvert
        setTimeout(() => {
          if (isOpen && !scannerRef.current) {
            initScannerRef.current();
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Erreur lors du traitement du code-barres:', error);
      showErrorToast('Erreur lors du traitement du code-barres');
    }
  }, [companyName, companyId, navigate, onProductFound, onClose, isOpen, stopScanner]);

  const initScanner = useCallback(async () => {
    try {
      const html5QrCode = new Html5Qrcode('barcode-scanner');
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          handleBarcodeScanned(decodedText);
        },
        () => {
          // Erreur de scan normale
        }
      );

      setIsScanning(true);
      setError(null);
    } catch (err: any) {
      console.error('Erreur lors de l\'initialisation du scanner:', err);
      setError(err.message || 'Impossible d\'accéder à la caméra');
      setIsScanning(false);
    }
  }, [handleBarcodeScanned]);

  // Créer une référence stable pour initScanner pour éviter les dépendances circulaires
  const initScannerRef = useRef(initScanner);
  useEffect(() => {
    initScannerRef.current = initScanner;
  }, [initScanner]);

  useEffect(() => {
    if (!isOpen) {
      // Nettoyer le scanner quand le modal se ferme
      stopScanner();
      setIsScanning(false);
      setError(null);
      return;
    }

    // Initialiser le scanner quand le modal s'ouvre
    initScanner();

    return () => {
      // Nettoyer lors du démontage
      stopScanner();
    };
  }, [isOpen, initScanner, stopScanner]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Scanner un code-barres</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {error ? (
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={initScanner}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Réessayer
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div
              id="barcode-scanner"
              className="w-full rounded-lg overflow-hidden"
              style={{ minHeight: '300px' }}
            />
            {isScanning && (
              <p className="text-sm text-gray-600 text-center">
                Pointez la caméra vers un code-barres ou QR code
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BarcodeScanner;
