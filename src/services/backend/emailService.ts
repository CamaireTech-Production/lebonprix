/**
 * Service to send emails via the backend API
 */

// Backend API URL - can be configured via environment variable
// Force HTTP for IP addresses (HTTPS doesn't work with IPs)
const getBackendApiUrl = (): string => {
  let url = import.meta.env.VITE_BACKEND_API_URL || 'http://93.127.203.115:8888';
  
  // CRITICAL: Force HTTP for IP addresses - HTTPS doesn't work with IPs
  // Match IP address pattern (e.g., 93.127.203.115) in URL
  const ipPattern = /^https:\/\/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/;
  if (ipPattern.test(url)) {
    url = url.replace('https://', 'http://');
    console.warn('⚠️ Backend URL changed from HTTPS to HTTP (IP addresses don\'t support HTTPS):', url);
  }
  
  // Also handle case where URL might have https:// with IP but no port specified
  if (url.startsWith('https://') && /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(url)) {
    url = url.replace('https://', 'http://');
    console.warn('⚠️ Backend URL changed from HTTPS to HTTP (IP addresses don\'t support HTTPS):', url);
  }
  
  return url;
};

const BACKEND_API_URL = getBackendApiUrl();

// Debug: Log the backend URL being used (only in development)
if (import.meta.env.DEV) {
  console.log('🔧 Backend API URL:', BACKEND_API_URL);
}

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
    // Final safeguard: Ensure URL is HTTP if it's an IP address
    let apiUrl = BACKEND_API_URL;
    if (apiUrl.startsWith('https://') && /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(apiUrl)) {
      apiUrl = apiUrl.replace('https://', 'http://');
      console.error('❌ CRITICAL: Backend URL was HTTPS with IP, forced to HTTP:', apiUrl);
    }
    
    const response = await fetch(`${apiUrl}/api/users/send-credentials`, {
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

