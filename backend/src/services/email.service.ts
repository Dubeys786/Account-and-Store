import nodemailer, { Transporter, SendMailOptions } from 'nodemailer';
import env from '../config/env';
import logger from '../utils/logger';

export interface SendReportEmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  message?: string;
  reportTitle: string;
  reportMetadata?: {
    dateRangeText?: string;
    storeName?: string;
    partyName?: string;
    recordCount: number;
  };
  attachment: {
    filename: string;
    content: Buffer;
    contentType: string;
  };
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  previewUrl?: string | false;
  recipients: {
    to: string[];
    cc: string[];
    bcc: string[];
  };
}

// RFC 5322 compliant simplified email validator regex
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export class EmailService {
  private static cachedTransporter: Transporter | null = null;
  private static isEthereal = false;

  /**
   * Validates single email address
   */
  public static isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    const trimmed = email.trim();
    if (trimmed.length > 254) return false;
    return EMAIL_REGEX.test(trimmed);
  }

  /**
   * Sanitizes header inputs to prevent CRLF injection
   */
  public static sanitizeHeader(value: string, fieldName = 'Header'): string {
    if (!value) return '';
    if (/[\r\n]/.test(value)) {
      throw new Error(`Potential email header injection detected in ${fieldName}. CRLF characters are strictly forbidden.`);
    }
    return value.trim();
  }

  /**
   * Parse comma/semicolon/newline-delimited string into array of sanitized email addresses
   */
  public static parseEmailList(input?: string | string[]): string[] {
    if (!input) return [];
    const rawList = Array.isArray(input) ? input : input.split(/[,;\n]+/);
    const emails: string[] = [];

    for (const item of rawList) {
      const trimmed = item.trim();
      if (!trimmed) continue;
      this.sanitizeHeader(trimmed, 'Recipient Email');
      if (!this.isValidEmail(trimmed)) {
        throw new Error(`Invalid email address: '${trimmed}'`);
      }
      if (!emails.includes(trimmed)) {
        emails.push(trimmed);
      }
    }

    return emails;
  }

  /**
   * Initializes or retrieves existing Nodemailer transporter
   */
  public static async getTransporter(): Promise<Transporter> {
    if (this.cachedTransporter) {
      return this.cachedTransporter;
    }

    // Check if production or custom SMTP is configured
    if (env.EMAIL_HOST && env.EMAIL_HOST.trim().length > 0) {
      logger.info(`[EMAIL] Initializing SMTP Transport using host: ${env.EMAIL_HOST}:${env.EMAIL_PORT} (secure: ${env.EMAIL_SECURE})`);
      this.isEthereal = false;
      this.cachedTransporter = nodemailer.createTransport({
        host: env.EMAIL_HOST.trim(),
        port: env.EMAIL_PORT,
        secure: env.EMAIL_SECURE,
        auth: env.EMAIL_USERNAME ? {
          user: env.EMAIL_USERNAME.trim(),
          pass: env.EMAIL_PASSWORD,
        } : undefined,
        tls: {
          rejectUnauthorized: env.NODE_ENV === 'production',
        },
      });
      return this.cachedTransporter;
    }

    // If no SMTP host is configured, initialize a real Ethereal SMTP test account
    logger.info('[EMAIL] No custom EMAIL_HOST configured. Initializing Ethereal SMTP test inbox for zero-setup verification...');
    try {
      const testAccount = await nodemailer.createTestAccount();
      this.isEthereal = true;
      this.cachedTransporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      logger.info(`[EMAIL] Ethereal SMTP Test Account ready: ${testAccount.user}`);
      return this.cachedTransporter;
    } catch (err: any) {
      logger.error(`[EMAIL] Failed to create Ethereal test account: ${err.message}`);
      throw new Error(`Email service initialization failed: ${err.message}`);
    }
  }

  /**
   * Reset transporter (useful for testing configuration changes)
   */
  public static resetTransporter(): void {
    this.cachedTransporter = null;
    this.isEthereal = false;
  }

  /**
   * Sends financial report email with binary attachment
   */
  public static async sendReportEmail(options: SendReportEmailOptions): Promise<EmailSendResult> {
    // 1. Sanitize and validate recipients
    const toEmails = this.parseEmailList(options.to);
    const ccEmails = this.parseEmailList(options.cc);
    const bccEmails = this.parseEmailList(options.bcc);

    if (toEmails.length === 0) {
      throw new Error('At least one valid recipient "To" email address is required.');
    }

    const totalRecipients = toEmails.length + ccEmails.length + bccEmails.length;
    if (totalRecipients > 10) {
      throw new Error(`Recipient limit exceeded. Maximum 10 recipients allowed per request (got ${totalRecipients}).`);
    }

    // 2. Sanitize Subject and Message
    const sanitizedSubject = this.sanitizeHeader(
      options.subject || `StockLedger - ${options.reportTitle} - ${new Date().toLocaleDateString('en-GB')}`,
      'Subject'
    );

    const reportTitle = options.reportTitle;
    const dateRangeText = options.reportMetadata?.dateRangeText || 'All Dates';
    const storeName = options.reportMetadata?.storeName || 'All Authorized Stores';
    const partyName = options.reportMetadata?.partyName || 'All Parties';
    const recordCount = options.reportMetadata?.recordCount ?? 0;

    // 3. Build Plaintext Body (Preserving required template)
    const textBody = (options.message && options.message.trim().length > 0)
      ? `${options.message.trim()}\n\n---\nReport: ${reportTitle}\nDate Range: ${dateRangeText}\nStore: ${storeName}\nParty: ${partyName}\nRecords: ${recordCount}\n\nThis report was generated from StockLedger.\n\nRegards,\nStockLedger\nAccounts & Finance`
      : `Hello,

Please find attached the requested StockLedger financial report.

Report:
${reportTitle}

Date Range:
${dateRangeText}

Store:
${storeName}

Party:
${partyName}

Records:
${recordCount}

This report was generated from StockLedger.

Regards,
StockLedger
Accounts & Finance`;

    // 4. Build Professional HTML Body
    const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 24px 32px; color: #ffffff; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
    .header p { margin: 4px 0 0 0; font-size: 13px; opacity: 0.85; }
    .content { padding: 32px; font-size: 14px; line-height: 1.6; }
    .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin: 20px 0; }
    .summary-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #e2e8f0; }
    .summary-row:last-child { border-bottom: none; }
    .summary-label { font-weight: 600; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .summary-value { font-weight: 600; color: #0f172a; text-align: right; }
    .custom-message { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin-bottom: 20px; border-radius: 0 6px 6px 0; font-size: 13px; color: #1e3a8a; }
    .footer { background: #f8fafc; padding: 20px 32px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>STOCKLEDGER</h1>
      <p>Store, Inventory & Enterprise Financial Management</p>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>Please find attached the requested financial report.</p>

      ${options.message ? `<div class="custom-message">${options.message.replace(/\n/g, '<br/>')}</div>` : ''}

      <div class="summary-card">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td class="summary-label" style="padding: 6px 0;">Report</td>
            <td class="summary-value" style="padding: 6px 0; text-align: right;">${reportTitle}</td>
          </tr>
          <tr>
            <td class="summary-label" style="padding: 6px 0;">Date Range</td>
            <td class="summary-value" style="padding: 6px 0; text-align: right;">${dateRangeText}</td>
          </tr>
          <tr>
            <td class="summary-label" style="padding: 6px 0;">Store / Branch</td>
            <td class="summary-value" style="padding: 6px 0; text-align: right;">${storeName}</td>
          </tr>
          <tr>
            <td class="summary-label" style="padding: 6px 0;">Party</td>
            <td class="summary-value" style="padding: 6px 0; text-align: right;">${partyName}</td>
          </tr>
          <tr>
            <td class="summary-label" style="padding: 6px 0;">Records</td>
            <td class="summary-value" style="padding: 6px 0; text-align: right; color: #2563eb;">${recordCount.toLocaleString()}</td>
          </tr>
        </table>
      </div>

      <p style="margin-top: 24px;">This report was securely generated from the StockLedger Enterprise Accounting engine.</p>
      <p style="margin-top: 16px;">Regards,<br><strong>StockLedger Accounts & Finance Team</strong></p>
    </div>
    <div class="footer">
      <p>Confidential Financial Communication &bull; Generated: ${new Date().toUTCString()}</p>
      <p style="font-size: 11px; margin-top: 4px;">If you received this message in error, please immediately notify the administrator and delete this communication.</p>
    </div>
  </div>
</body>
</html>
`;

    // 5. Get transporter & send
    const transporter = await this.getTransporter();

    const fromAddress = env.EMAIL_FROM_NAME
      ? `"${env.EMAIL_FROM_NAME}" <${env.EMAIL_FROM}>`
      : env.EMAIL_FROM;

    const mailOptions: SendMailOptions = {
      from: fromAddress,
      to: toEmails.join(', '),
      cc: ccEmails.length > 0 ? ccEmails.join(', ') : undefined,
      bcc: bccEmails.length > 0 ? bccEmails.join(', ') : undefined,
      subject: sanitizedSubject,
      text: textBody,
      html: htmlBody,
      attachments: [
        {
          filename: options.attachment.filename,
          content: options.attachment.content,
          contentType: options.attachment.contentType,
        },
      ],
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      let previewUrl: string | false = false;

      if (this.isEthereal) {
        previewUrl = nodemailer.getTestMessageUrl(info) || false;
        if (previewUrl) {
          logger.info(`[EMAIL] 🚀 Report email dispatched via Ethereal SMTP! Preview URL: ${previewUrl}`);
        }
      } else {
        logger.info(`[EMAIL] 🚀 Report email dispatched via SMTP to ${toEmails.join(', ')} (MessageID: ${info.messageId})`);
      }

      return {
        success: true,
        messageId: info.messageId,
        previewUrl,
        recipients: {
          to: toEmails,
          cc: ccEmails,
          bcc: bccEmails,
        },
      };
    } catch (err: any) {
      logger.error(`[EMAIL] Failed to send email via SMTP: ${err.message}`);
      // Sanitize error message to avoid revealing passwords
      const safeMessage = err.message.replace(/(pass|password|auth|secret)=[^& ]+/gi, '$1=***');
      throw new Error(`Email delivery failed: ${safeMessage}`);
    }
  }
}

export default EmailService;
