# Employee Invitation System - EmailJS Setup

## Overview
The employee invitation system uses EmailJS to send invitation emails directly from the frontend without requiring server configuration.

## Setup Instructions

### 1. Create EmailJS Account
1. Go to [EmailJS](https://www.emailjs.com/)
2. Sign up for a free account
3. Verify your email address

### 2. Create Email Service
1. In EmailJS dashboard, go to "Email Services"
2. Click "Add New Service"
3. Choose your email provider (Gmail, Outlook, etc.)
4. Follow the setup instructions for your provider
5. Note down the **Service ID**

### 3. Create Email Template
1. Go to "Email Templates"
2. Click "Create New Template"
3. Use this template structure:

```
Subject: You're invited to join {{company_name}}!

Hello {{to_name}},

{{inviter_name}} has invited you to join {{company_name}} as a {{role}}.

Click the link below to accept your invitation:
{{invite_link}}

This invitation expires in {{expires_in_days}} days.

Best regards,
{{from_name}}
```

4. Note down the **Template ID**

### 4. Get Public Key
1. Go to "Account" → "General"
2. Copy your **Public Key**

### 5. Configure Environment Variables
Create a `.env` file in your project root with:

```env
VITE_EMAILJS_SERVICE_ID=your_service_id_here
VITE_EMAILJS_TEMPLATE_ID=your_template_id_here
VITE_EMAILJS_PUBLIC_KEY=your_public_key_here
```

### 6. Test Configuration
The system includes a test function that you can call to verify your EmailJS setup is working correctly.

## Email Templates

### Invitation Email Template
- **Subject**: You're invited to join {{company_name}}!
- **Body**: Professional invitation with company details, role, and invitation link
- **Expiration**: Shows when invitation expires

### Company Access Notification Template
- **Subject**: You now have access to {{company_name}}
- **Body**: Notification for existing users who are added to a company
- **Action**: Direct link to company dashboard

## Features

### For New Users
- Receive invitation email with signup link
- Create account and automatically join company
- Redirected to company dashboard after acceptance

### For Existing Users
- Receive notification email about new company access
- Company is added to their account immediately
- Can access company dashboard right away

### For Directors/Admins
- Send invitations from HR Management page
- Track pending invitations
- Resend or cancel invitations
- View team members and their roles

## Security Notes
- Invitation links expire after 7 days
- Each invitation has a unique ID
- Users can only accept invitations once
- Directors can revoke invitations at any time

## Troubleshooting

### Common Issues
1. **Email not sending**: Check EmailJS service configuration
2. **Template not found**: Verify template ID in environment variables
3. **Invalid public key**: Ensure public key is correct and active
4. **Service not working**: Check email provider settings in EmailJS

### Testing
Use the test function in `emailService.ts` to verify your configuration:
```typescript
import { testEmailConfiguration } from './services/emailService';

const result = await testEmailConfiguration();
console.log(result);
```
