import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { NavigationService } from '../../services/navigationService';

/**
 * Composant de test pour vérifier le NavigationService
 * À supprimer après les tests
 */
export default function NavigationTest() {
  const [testResult, setTestResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { currentUser } = useAuth();

  const testCompanyMode = async () => {
    if (!currentUser?.uid) {
      setTestResult({ error: 'Aucun utilisateur connecté' });
      return;
    }

    setIsLoading(true);
    try {
      console.log('🧪 Test NavigationService.handleCompanyMode...');
      const result = await NavigationService.handleCompanyMode(currentUser.uid);
      console.log('🧪 Résultat:', result);
      setTestResult(result);
    } catch (error) {
      console.error('🧪 Erreur test:', error);
      setTestResult({ error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const testDefaultMode = async () => {
    if (!currentUser?.uid) {
      setTestResult({ error: 'Aucun utilisateur connecté' });
      return;
    }

    setIsLoading(true);
    try {
      console.log('🧪 Test NavigationService.getDefaultMode...');
      const result = await NavigationService.getDefaultMode(currentUser.uid);
      console.log('🧪 Mode par défaut:', result);
      setTestResult({ defaultMode: result });
    } catch (error) {
      console.error('🧪 Erreur test:', error);
      setTestResult({ error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  if (process.env.NODE_ENV !== 'development') {
    return null; // Ne pas afficher en production
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg p-4 shadow-lg z-50 max-w-sm">
      <h3 className="text-sm font-semibold text-gray-900 mb-2">🧪 Navigation Test</h3>
      <div className="space-y-2">
        <button
          onClick={testCompanyMode}
          disabled={isLoading}
          className="w-full px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          Test Company Mode
        </button>
        <button
          onClick={testDefaultMode}
          disabled={isLoading}
          className="w-full px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          Test Default Mode
        </button>
      </div>
      
      {testResult && (
        <div className="mt-3 p-2 bg-gray-100 rounded text-xs">
          <pre className="whitespace-pre-wrap">
            {JSON.stringify(testResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
