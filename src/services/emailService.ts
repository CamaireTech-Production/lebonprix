import emailjs from '@emailjs/browser';

// EmailJS configuration - these should be set in environment variables
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || 'service_default';
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'template_default';
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || 'public_key_default';

// Initialize EmailJS
emailjs.init(EMAILJS_PUBLIC_KEY);

export interface InvitationEmailData {
  to_email: string;
  to_name: string;
  company_name: string;
  inviter_name: string;
  role: string;
  invite_link: string;
  expires_in_days: number;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send invitation email using EmailJS
 * @param emailData - Email template data
 * @returns Promise with email result
 */
export const sendInvitationEmail = async (emailData: InvitationEmailData): Promise<EmailResult> => {
  try {
    console.log('📧 Sending invitation email to:', emailData.to_email);
    
    const templateParams = {
      to_email: emailData.to_email,
      to_name: emailData.to_name,
      company_name: emailData.company_name,
      inviter_name: emailData.inviter_name,
      role: emailData.role,
      invite_link: emailData.invite_link,
      expires_in_days: emailData.expires_in_days,
      from_name: 'Le Bon Prix Team'
    };

    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams
    );

    console.log('✅ Email sent successfully:', response);
    
    return {
      success: true,
      messageId: response.text
    };
  } catch (error: unknown) {
    console.error('❌ Failed to send invitation email:', error);
    
    return {
      success: false,
      error: (error as Error).message || 'Failed to send email'
    };
  }
};

/**
 * Send notification email to existing user about new company access
 * @param emailData - Email template data
 * @returns Promise with email result
 */
export const sendCompanyAccessNotification = async (emailData: InvitationEmailData): Promise<EmailResult> => {
  try {
    console.log('📧 Sending company access notification to:', emailData.to_email);
    
    const templateParams = {
      to_email: emailData.to_email,
      to_name: emailData.to_name,
      company_name: emailData.company_name,
      inviter_name: emailData.inviter_name,
      role: emailData.role,
      invite_link: emailData.invite_link,
      expires_in_days: emailData.expires_in_days,
      from_name: 'Le Bon Prix Team',
      message_type: 'company_access'
    };

    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams
    );

    console.log('✅ Company access notification sent successfully:', response);
    
    return {
      success: true,
      messageId: response.text
    };
  } catch (error: unknown) {
    console.error('❌ Failed to send company access notification:', error);
    
    return {
      success: false,
      error: (error as Error).message || 'Failed to send notification'
    };
  }
};

/**
 * Test EmailJS configuration
 * @returns Promise with test result
 */
export const testEmailConfiguration = async (): Promise<EmailResult> => {
  try {
    const testParams = {
      to_email: 'test@example.com',
      to_name: 'Test User',
      company_name: 'Test Company',
      inviter_name: 'Test Inviter',
      role: 'staff',
      invite_link: 'https://example.com/invite/test',
      expires_in_days: 7,
      from_name: 'Le Bon Prix Team'
    };

    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      testParams
    );

    return {
      success: true,
      messageId: response.text
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: (error as Error).message || 'Email configuration test failed'
    };
  }
};
