/**
 * Service to send emails via the backend API
 */

// Backend API URL - can be configured via environment variable
// CRITICAL: Force HTTP for IP addresses - HTTPS doesn't work with IPs
// This function ALWAYS returns HTTP when an IP address is detected
const getBackendApiUrl = (): string => {
  let url = import.meta.env.VITE_BACKEND_API_URL || 'http://93.127.203.115:8888';
  
  // ENFORCE HTTP: If URL contains ANY IP address pattern, force HTTP
  // Match IP address pattern anywhere in the URL (e.g., 93.127.203.115)
  const ipPattern = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/;
  
  if (ipPattern.test(url)) {
    // If URL contains IP address, FORCE HTTP (remove https:// if present)
    url = url.replace(/^https:\/\//, 'http://');
    // Ensure it starts with http://
    if (!url.startsWith('http://') && !url.startsWith('http://')) {
      url = 'http://' + url.replace(/^https?:\/\//, '');
    }
    console.warn('🔒 ENFORCED HTTP for IP address (HTTPS not supported):', url);
  }
  
  // Final check: If somehow still HTTPS with IP, force conversion
  if (url.startsWith('https://') && ipPattern.test(url)) {
    url = url.replace('https://', 'http://');
    console.error('❌ CRITICAL: Forced HTTPS to HTTP conversion:', url);
  }
  
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
    
    // Double-check: If still HTTPS with IP, force HTTP
    if (apiUrl.startsWith('https://') && /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(apiUrl)) {
      apiUrl = apiUrl.replace('https://', 'http://');
      console.error('❌ CRITICAL: Runtime enforcement - forced HTTPS to HTTP:', apiUrl);
    }
    
    // ABSOLUTE FINAL CHECK: Force HTTP if IP detected (last chance before fetch)
    const finalUrl = apiUrl.replace(/^https:\/\/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/, 'http://$1');
    if (finalUrl !== apiUrl) {
      console.error('🚨 LAST-MINUTE ENFORCEMENT: Changed HTTPS to HTTP:', finalUrl);
    }
    
    // Log the final URL being used
    console.log('🌐 Making API request to:', finalUrl);
    
    const response = await fetch(`${finalUrl}/api/users/send-credentials`, {
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

