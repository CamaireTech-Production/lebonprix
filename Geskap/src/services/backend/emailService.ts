/**
 * Service to send emails via the backend API
 */

// Backend API URL - can be configured via environment variable
const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:4500';

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
    const response = await fetch(`${BACKEND_API_URL}/api/users/send-credentials`, {
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

