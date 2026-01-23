/**
 * Service to send emails via the backend API
 */

// Backend API URL - can be configured via environment variable
// CRITICAL: Force HTTP for IP addresses - HTTPS doesn't work with IPs
// This function ALWAYS returns HTTP when an IP address is detected
const getBackendApiUrl = (): string => {
  const originalUrl = import.meta.env.VITE_BACKEND_API_URL || 'http://93.127.203.115:8888';
  let url = originalUrl;
  
  // DEBUG: Log original URL
  console.log('🔍 [DEBUG] Original Backend URL from env:', originalUrl);
  console.log('🔍 [DEBUG] Protocol:', originalUrl.startsWith('https://') ? 'HTTPS' : originalUrl.startsWith('http://') ? 'HTTP' : 'UNKNOWN');
  
  // ENFORCE HTTP: If URL contains ANY IP address pattern, force HTTP
  // Match IP address pattern anywhere in the URL (e.g., 93.127.203.115)
  const ipPattern = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/;
  const hasIp = ipPattern.test(url);
  
  console.log('🔍 [DEBUG] Contains IP address:', hasIp);
  if (hasIp) {
    console.log('🔍 [DEBUG] IP address detected, enforcing HTTP...');
  }
  
  if (hasIp) {
    // If URL contains IP address, FORCE HTTP (remove https:// if present)
    const beforeConversion = url;
    url = url.replace(/^https:\/\//, 'http://');
    // Ensure it starts with http://
    if (!url.startsWith('http://') && !url.startsWith('http://')) {
      url = 'http://' + url.replace(/^https?:\/\//, '');
    }
    
    if (beforeConversion !== url) {
      console.warn('🔒 [ENFORCEMENT] Changed from HTTPS to HTTP:', beforeConversion, '→', url);
    } else {
      console.log('✅ [ENFORCEMENT] Already HTTP:', url);
    }
  }
  
  // Final check: If somehow still HTTPS with IP, force conversion
  if (url.startsWith('https://') && ipPattern.test(url)) {
    const beforeFinal = url;
    url = url.replace('https://', 'http://');
    console.error('❌ [CRITICAL] Final enforcement - Forced HTTPS to HTTP:', beforeFinal, '→', url);
  }
  
  // Final debug log
  console.log('🔍 [DEBUG] Final Backend URL:', url);
  console.log('🔍 [DEBUG] Final Protocol:', url.startsWith('https://') ? 'HTTPS ⚠️' : url.startsWith('http://') ? 'HTTP ✅' : 'UNKNOWN ❌');
  
  return url;
};

// DO NOT cache the URL - always get it fresh to enforce HTTP
// This ensures runtime enforcement works even if env var changes
const getBackendApiUrlFresh = (): string => {
  return getBackendApiUrl();
};

export interface SendCredentialsEmailParams {
  toEmail: string;
  toName: string;
  companyName: string;
  creatorName: string;
  username: string;
  email: string;
  password: string;
  loginUrl: string;
  dashboardUrl?: string;
  companyLogo?: string;
}

export interface SendCredentialsEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send user credentials email via backend API
 * @param params - Email parameters
 * @returns Result of the email sending operation
 */
export const sendCredentialsEmail = async (
  params: SendCredentialsEmailParams
): Promise<SendCredentialsEmailResult> => {
  try {
    // FINAL ENFORCEMENT: Get fresh URL and force HTTP for IP addresses
    let apiUrl = getBackendApiUrlFresh();
    console.log('🔍 [DEBUG] API URL after getBackendApiUrlFresh():', apiUrl);
    console.log('🔍 [DEBUG] Is HTTPS?', apiUrl.startsWith('https://'));
    
    // Double-check: If still HTTPS with IP, force HTTP
    if (apiUrl.startsWith('https://') && /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(apiUrl)) {
      const before = apiUrl;
      apiUrl = apiUrl.replace('https://', 'http://');
      console.error('❌ [CRITICAL] Runtime enforcement - forced HTTPS to HTTP:', before, '→', apiUrl);
    }
    
    // ABSOLUTE FINAL CHECK: Force HTTP if IP detected (last chance before fetch)
    const finalUrl = apiUrl.replace(/^https:\/\/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/, 'http://$1');
    if (finalUrl !== apiUrl) {
      console.error('🚨 [LAST-MINUTE] Changed HTTPS to HTTP:', apiUrl, '→', finalUrl);
    }
    
    // Final debug log before fetch
    console.log('🌐 [FINAL] Making API request to:', finalUrl);
    console.log('🌐 [FINAL] Protocol:', finalUrl.startsWith('https://') ? 'HTTPS ⚠️' : finalUrl.startsWith('http://') ? 'HTTP ✅' : 'UNKNOWN ❌');
    
    // Construct the full endpoint URL
    let endpointUrl = `${finalUrl}/api/users/send-credentials`;
    
    // ABSOLUTE FINAL ENFORCEMENT: Force HTTP in the actual URL string
    // This handles cases where the URL might have been constructed elsewhere
    endpointUrl = endpointUrl.replace(/^https:\/\/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/, 'http://$1');
    
    console.log('🌐 [FINAL] Full endpoint URL:', endpointUrl);
    console.log('🌐 [FINAL] Endpoint Protocol:', endpointUrl.startsWith('https://') ? 'HTTPS ⚠️' : endpointUrl.startsWith('http://') ? 'HTTP ✅' : 'UNKNOWN ❌');
    
    // Verify one more time before fetch
    if (endpointUrl.startsWith('https://') && /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(endpointUrl)) {
      endpointUrl = endpointUrl.replace('https://', 'http://');
      console.error('🚨 [PRE-FETCH] Last second enforcement - forced HTTPS to HTTP:', endpointUrl);
    }
    
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add API key if configured
        ...(import.meta.env.VITE_BACKEND_API_KEY && {
          'x-api-key': import.meta.env.VITE_BACKEND_API_KEY
        })
      },
      body: JSON.stringify(params)
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Erreur lors de l\'envoi de l\'email'
      };
    }

    return {
      success: true,
      messageId: data.messageId
    };
  } catch (error: any) {
    console.error('Error sending credentials email:', error);
    return {
      success: false,
      error: error.message || 'Erreur de connexion au serveur'
    };
  }
};

