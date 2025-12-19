import React, { useState } from 'react';
import { Download, TestTube } from 'lucide-react';

export const TestButton: React.FC = () => {
  const [testResults, setTestResults] = useState<string[]>([]);

  const runPWATests = () => {
    const results: string[] = [];
    
    // Test 1: Service Worker
    if ('serviceWorker' in navigator) {
      results.push('✅ Service Worker: Supported');
      navigator.serviceWorker.getRegistration()
        .then(registration => {
          if (registration) {
            results.push('✅ Service Worker: Registered');
          } else {
            results.push('❌ Service Worker: Not registered');
          }
        })
        .catch(error => {
          results.push(`❌ Service Worker: Error - ${error.message}`);
        });
    } else {
      results.push('❌ Service Worker: Not supported');
    }

    // Test 2: Manifest
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) {
      results.push('✅ Manifest: Link found');
      fetch((manifestLink as HTMLLinkElement).href)
        .then(response => {
          if (response.ok) {
            results.push('✅ Manifest: File accessible');
            return response.json();
          } else {
            results.push('❌ Manifest: File not accessible');
          }
        })
        .then(manifest => {
          if (manifest) {
            results.push(`✅ Manifest: Valid JSON (${manifest.icons?.length || 0} icons)`);
          }
        })
        .catch(error => {
          results.push(`❌ Manifest: Error - ${error.message}`);
        });
    } else {
      results.push('❌ Manifest: Link not found');
    }

    // Test 3: HTTPS
    if (location.protocol === 'https:' || location.hostname === 'localhost') {
      results.push('✅ HTTPS: Secure connection');
    } else {
      results.push('❌ HTTPS: Insecure connection');
    }

    // Test 4: Browser Support
    const userAgent = navigator.userAgent;
    if (/Chrome/.test(userAgent)) {
      results.push('✅ Browser: Chrome (Full PWA support)');
    } else if (/Edg/.test(userAgent)) {
      results.push('✅ Browser: Edge (Full PWA support)');
    } else if (/Firefox/.test(userAgent)) {
      results.push('⚠️ Browser: Firefox (Limited PWA support)');
    } else if (/Safari/.test(userAgent)) {
      results.push('⚠️ Browser: Safari (iOS: Manual install only)');
    } else {
      results.push('❓ Browser: Unknown (PWA support unknown)');
    }

    // Test 5: Install Prompt
    if ('serviceWorker' in navigator && manifestLink && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      results.push('✅ Install Prompt: Should be available');
    } else {
      results.push('❌ Install Prompt: Requirements not met');
    }

    setTestResults(results);
  };

  const triggerInstallPrompt = () => {
    // Try to trigger the beforeinstallprompt event manually
    const event = new Event('beforeinstallprompt');
    window.dispatchEvent(event);
    setTestResults(prev => [...prev, '🔧 Manual install prompt triggered']);
  };

  return (
    <div className="fixed top-4 left-4 z-50 bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-sm">
      <div className="flex items-center space-x-2 mb-3">
        <TestTube className="h-5 w-5 text-blue-600" />
        <h3 className="font-semibold text-gray-800">PWA Test</h3>
      </div>
      
      <div className="space-y-2">
        <button
          onClick={runPWATests}
          className="w-full bg-blue-600 text-white py-2 px-3 rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          Run PWA Tests
        </button>
        
        <button
          onClick={triggerInstallPrompt}
          className="w-full bg-green-600 text-white py-2 px-3 rounded-lg text-sm hover:bg-green-700 transition-colors flex items-center justify-center space-x-1"
        >
          <Download className="h-4 w-4" />
          <span>Trigger Install</span>
        </button>
      </div>

      {testResults.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="text-xs space-y-1 max-h-32 overflow-y-auto">
            {testResults.map((result, index) => (
              <div key={index} className="text-gray-700">
                {result}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Export with old name for backward compatibility
export const PWATestButton = TestButton;

