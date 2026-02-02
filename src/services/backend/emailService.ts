/**
 * Service to send emails via the backend API
 */

// Backend API URL - can be configured via environment variable
// Using domain on port 8888 (geskap-api.camairetech.com:8888)
const getBackendApiUrl = (): string => {
  const rawUrl =
    import.meta.env.VITE_BACKEND_API_URL || 'http://geskap-api.camairetech.com:8888';

  // Normalize the base URL:
  // - trim whitespace
  // - remove any trailing slashes so we don't end up with "//api/..."
  const normalizedUrl = rawUrl.trim().replace(/\/+$/, '');

  // DEBUG: Log URL being used
  console.log('🔍 [DEBUG] Backend URL from env:', rawUrl);
  console.log('🔍 [DEBUG] Backend URL normalized:', normalizedUrl);
  console.log(
    '🔍 [DEBUG] Protocol:',
    normalizedUrl.startsWith('https://')
      ? 'HTTPS ✅'
      : normalizedUrl.startsWith('http://')
      ? 'HTTP'
      : 'UNKNOWN'
  );

  return normalizedUrl;
};

// DO NOT cache the URL - always get it fresh to enforce HTTP
// This ensures runtime enforcement works even if env var changes
const getBackendApiUrlFresh = (): string => {
  return getBackendApiUrl();
};

export interface SendInvitationEmailParams {
  toEmail: string;
  toName: string;
  companyName: string;
  inviterName: string;
  role: string;
  inviteLink: string;
  expiresInDays?: number;
  companyLogo?: string;
}

export interface SendInvitationEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send invitation email via backend API
 * @param params - Email parameters
 * @returns Result of the email sending operation
 */
export const sendInvitationEmail = async (
  params: SendInvitationEmailParams
): Promise<SendInvitationEmailResult> => {
  try {
    // Get backend URL (now using domain with SSL)
    const apiUrl = getBackendApiUrlFresh();
    const endpointUrl = `${apiUrl}/api/users/send-invitation`;
    
    // Debug log
    console.log('🌐 [FINAL] Making invitation API request to:', endpointUrl);
    console.log('🌐 [FINAL] Protocol:', endpointUrl.startsWith('https://') ? 'HTTPS ✅' : endpointUrl.startsWith('http://') ? 'HTTP' : 'UNKNOWN');
    
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
        error: data.error || 'Erreur lors de l\'envoi de l\'email d\'invitation'
      };
    }

    return {
      success: true,
      messageId: data.messageId
    };
  } catch (error: any) {
    console.error('Error sending invitation email:', error);
    return {
      success: false,
      error: error.message || 'Erreur de connexion au serveur'
    };
  }
};

export interface SendCompanyAccessNotificationParams {
  toEmail: string;
  toName: string;
  companyName: string;
  inviterName: string;
  role: string;
  inviteLink: string;
  companyLogo?: string;
}

export interface SendCompanyAccessNotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send company access notification email via backend API
 * @param params - Email parameters
 * @returns Result of the email sending operation
 */
export const sendCompanyAccessNotification = async (
  params: SendCompanyAccessNotificationParams
): Promise<SendCompanyAccessNotificationResult> => {
  try {
    // Get backend URL (now using domain with SSL)
    const apiUrl = getBackendApiUrlFresh();
    const endpointUrl = `${apiUrl}/api/users/send-company-access-notification`;
    
    // Debug log
    console.log('🌐 [FINAL] Making company access notification API request to:', endpointUrl);
    console.log('🌐 [FINAL] Protocol:', endpointUrl.startsWith('https://') ? 'HTTPS ✅' : endpointUrl.startsWith('http://') ? 'HTTP' : 'UNKNOWN');
    
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
        error: data.error || 'Erreur lors de l\'envoi de la notification d\'accès'
      };
    }

    return {
      success: true,
      messageId: data.messageId
    };
  } catch (error: any) {
    console.error('Error sending company access notification:', error);
    return {
      success: false,
      error: error.message || 'Erreur de connexion au serveur'
    };
  }
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
    // Get backend URL (now using domain with SSL)
    const apiUrl = getBackendApiUrlFresh();
    const endpointUrl = `${apiUrl}/api/users/send-credentials`;
    
    // Debug log
    console.log('🌐 [FINAL] Making API request to:', endpointUrl);
    console.log('🌐 [FINAL] Protocol:', endpointUrl.startsWith('https://') ? 'HTTPS ✅' : endpointUrl.startsWith('http://') ? 'HTTP' : 'UNKNOWN');
    
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

