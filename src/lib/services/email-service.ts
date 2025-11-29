/**
 * Email Service
 * Handles sending emails via Resend API
 * 
 * IMPORTANT: Email sending is BLOCKED by default during development.
 * Set ALLOW_EMAIL_SENDING=true to enable actual sending.
 */

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  blocked?: boolean;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  fromName?: string;
}

/**
 * Check if email sending is enabled
 */
function isEmailSendingEnabled(): boolean {
  return process.env.ALLOW_EMAIL_SENDING === 'true';
}

/**
 * Send an email via Resend API
 * 
 * @param options Email options
 * @returns Result with success status and message ID (if sent) or error
 */
export async function sendEmail(options: EmailOptions): Promise<EmailSendResult> {
  const { to, subject, html, from, fromName } = options;

  // Check if email sending is blocked
  if (!isEmailSendingEnabled()) {
    console.log('[Email Service] Email sending is BLOCKED (ALLOW_EMAIL_SENDING not set to true)');
    console.log('[Email Service] Would send email:', {
      to,
      subject,
      from: from || process.env.EMAIL_FROM_ADDRESS,
      fromName: fromName || process.env.EMAIL_FROM_NAME,
      htmlPreview: html.substring(0, 100) + '...',
    });

    // Return success but mark as blocked
    return {
      success: true,
      messageId: `blocked-${Date.now()}`,
      blocked: true,
    };
  }

  // Validate required environment variables
  if (!process.env.RESEND_API_KEY) {
    return {
      success: false,
      error: 'RESEND_API_KEY not configured',
    };
  }

  if (!process.env.EMAIL_FROM_ADDRESS) {
    return {
      success: false,
      error: 'EMAIL_FROM_ADDRESS not configured',
    };
  }

  try {
    // Dynamic import to avoid loading Resend if not needed
    let Resend;
    try {
      const resendModule = await import('resend');
      Resend = resendModule.Resend;
    } catch (importError) {
      return {
        success: false,
        error: 'Resend package not installed. Run: npm install resend',
      };
    }
    
    const resend = new Resend(process.env.RESEND_API_KEY);

    const fromAddress = from || process.env.EMAIL_FROM_ADDRESS;
    const fromNameValue = fromName || process.env.EMAIL_FROM_NAME || 'Attendry';
    const fromString = fromNameValue ? `${fromNameValue} <${fromAddress}>` : fromAddress;

    const { data, error } = await resend.emails.send({
      from: fromString,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('[Email Service] Resend API error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error from Resend API',
      };
    }

    console.log('[Email Service] Email sent successfully:', {
      messageId: data?.id,
      to,
      subject,
    });

    return {
      success: true,
      messageId: data?.id,
    };
  } catch (error: any) {
    console.error('[Email Service] Error sending email:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email',
    };
  }
}

/**
 * Send outreach email (wrapper for agent drafts)
 */
export async function sendOutreachEmail(
  to: string,
  subject: string,
  messageBody: string,
  options?: {
    from?: string;
    fromName?: string;
  }
): Promise<EmailSendResult> {
  // Convert plain text to HTML if needed
  const html = messageBody.includes('<') && messageBody.includes('>')
    ? messageBody
    : `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">${messageBody.replace(/\n/g, '<br>')}</div>`;

  return sendEmail({
    to,
    subject,
    html,
    from: options?.from,
    fromName: options?.fromName,
  });
}

/**
 * Verify email service configuration
 */
export function verifyEmailConfig(): {
  configured: boolean;
  sendingEnabled: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  let configured = true;

  if (!process.env.RESEND_API_KEY) {
    missing.push('RESEND_API_KEY');
    configured = false;
  }

  if (!process.env.EMAIL_FROM_ADDRESS) {
    missing.push('EMAIL_FROM_ADDRESS');
    configured = false;
  }

  const sendingEnabled = isEmailSendingEnabled();

  return {
    configured,
    sendingEnabled,
    missing,
  };
}

