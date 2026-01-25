import { useState } from 'react';
import { Card, Button } from '@components/common';
import { Copy, Check, X, Mail, User, Lock, ExternalLink } from 'lucide-react';
import { showSuccessToast } from '@utils/core/toast';

interface UserCreationSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  credentials: {
    username: string;
    email: string;
    password: string;
  };
  companyName: string;
  loginUrl: string;
  dashboardUrl?: string;
  emailSent?: boolean;
}

const UserCreationSummaryModal = ({
  isOpen,
  onClose,
  credentials,
  companyName,
  loginUrl,
  dashboardUrl,
  emailSent = false
}: UserCreationSummaryModalProps) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      showSuccessToast(`${fieldName} copié dans le presse-papiers`);
      
      setTimeout(() => {
        setCopiedField(null);
      }, 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  const handleCopyAll = async () => {
    const allCredentials = `Nom d'utilisateur: ${credentials.username}\nEmail: ${credentials.email}\nMot de passe: ${credentials.password}\n\nLien de connexion: ${loginUrl}${dashboardUrl ? `\nDashboard: ${dashboardUrl}` : ''}`;
    await handleCopy(allCredentials, 'Tous les identifiants');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal panel - smaller and more compact */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <Card>
            <div className="p-4">
              {/* Header - more compact */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    ✅ Compte créé avec succès
                  </h3>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Identifiants pour {companyName}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Fermer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Email sent notification - more compact */}
              {emailSent && (
                <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded-md">
                  <div className="flex items-center">
                    <Mail className="h-4 w-4 text-green-600 mr-2" />
                    <p className="text-xs text-green-800">
                      Email envoyé à <strong>{credentials.email}</strong>
                    </p>
                  </div>
                </div>
              )}

              {/* Credentials Section - more compact */}
              <div className="space-y-3 mb-4">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <h4 className="text-xs font-medium text-gray-900 mb-3">
                    📋 Identifiants de connexion
                  </h4>

                  {/* Username */}
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      <User className="h-3 w-3 inline mr-1" />
                      Nom d'utilisateur
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={credentials.username}
                        className="flex-1 bg-white border border-gray-300 rounded-md px-2 py-1.5 text-xs font-mono text-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(credentials.username, 'Nom d\'utilisateur')}
                        className="px-2"
                      >
                        {copiedField === 'Nom d\'utilisateur' ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      <Mail className="h-3 w-3 inline mr-1" />
                      Email
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={credentials.email}
                        className="flex-1 bg-white border border-gray-300 rounded-md px-2 py-1.5 text-xs font-mono text-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(credentials.email, 'Email')}
                        className="px-2"
                      >
                        {copiedField === 'Email' ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Password */}
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      <Lock className="h-3 w-3 inline mr-1" />
                      Mot de passe
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={credentials.password}
                        className="flex-1 bg-white border border-red-300 rounded-md px-2 py-1.5 text-xs font-mono text-red-600 font-semibold focus:outline-none focus:ring-1 focus:ring-red-500"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(credentials.password, 'Mot de passe')}
                        className="px-2"
                      >
                        {copiedField === 'Mot de passe' ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-red-600 mt-1">
                      ⚠️ Conservez en sécurité
                    </p>
                  </div>

                  {/* Login URL */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      <ExternalLink className="h-3 w-3 inline mr-1" />
                      Lien de connexion
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={loginUrl}
                        className="flex-1 bg-white border border-gray-300 rounded-md px-2 py-1.5 text-xs font-mono text-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(loginUrl, 'Lien de connexion')}
                        className="px-2"
                      >
                        {copiedField === 'Lien de connexion' ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Warning - more compact */}
              <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-xs text-yellow-800">
                  <strong>Note:</strong> Partagez de manière sécurisée. Changer le mot de passe après la première connexion.
                </p>
              </div>

              {/* Actions - more compact */}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyAll}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copier tout
                </Button>
                <Button
                  size="sm"
                  onClick={onClose}
                >
                  Fermer
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default UserCreationSummaryModal;

