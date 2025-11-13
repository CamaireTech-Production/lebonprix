import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import QRCode from 'react-qr-code';
import type { Product } from '../../types/models';
import { formatEAN13 } from '../../services/barcodeService';

interface BarcodeGeneratorProps {
  product: Product;
  companyName: string;
  companyId: string;
  mode?: 'buy' | 'view';
}

const BarcodeGenerator: React.FC<BarcodeGeneratorProps> = ({
  product,
  companyName,
  companyId,
  mode = 'view'
}) => {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const barCode = product.barCode || '';

  useEffect(() => {
    if (barcodeRef.current && barCode) {
      try {
        JsBarcode(barcodeRef.current, barCode, {
          format: 'EAN13',
          width: 2,
          height: 80,
          displayValue: true,
          fontSize: 14,
          margin: 10
        });
      } catch (error) {
        console.error('Erreur lors de la génération du code-barres:', error);
      }
    }
  }, [barCode]);

  // Générer l'URL selon le mode
  const baseUrl = window.location.origin;
  const productUrl = `/catalogue/${encodeURIComponent(companyName)}/${companyId}/product/${product.id}`;
  const qrCodeUrl = mode === 'buy'
    ? `${baseUrl}${productUrl}?action=buy`
    : `${baseUrl}${productUrl}?action=view`;

  if (!barCode) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-500 text-center">
          Aucun code-barres disponible pour ce produit
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Code-barres EAN-13 */}
      <div className="p-4 bg-white rounded-lg border border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Code-barres EAN-13</h3>
        <div className="flex flex-col items-center">
          <svg ref={barcodeRef} className="w-full max-w-md" />
          <p className="text-xs text-gray-500 mt-2 font-mono">
            {formatEAN13(barCode)}
          </p>
        </div>
      </div>

      {/* QR Code */}
      <div className="p-4 bg-white rounded-lg border border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          QR Code pour {mode === 'buy' ? 'achat direct' : 'consultation'}
        </h3>
        <div className="flex flex-col items-center">
          <div className="bg-white p-4 rounded-lg">
            <QRCode
              value={qrCodeUrl}
              size={200}
              level="H"
            //  includeMargin={true}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center max-w-xs break-all">
            {qrCodeUrl}
          </p>
        </div>
      </div>
    </div>
  );
};

export default BarcodeGenerator;

