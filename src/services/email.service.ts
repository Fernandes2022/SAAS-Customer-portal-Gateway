import nodemailer from 'nodemailer';
import { env } from '../env';
import { logger } from '../logger';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private static transporter = (() => {
    if (env.GMAIL_USER && env.GMAIL_APP_PASSWORD) {
      return nodemailer.createTransport({
        service: 'gmail',
        auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD },
      });
    }
    logger.warn('GMAIL_USER or GMAIL_APP_PASSWORD not set; emails will not be sent');
    return nodemailer.createTransport({ jsonTransport: true });
  })();

  static async send(options: SendEmailOptions): Promise<void> {
    if (!env.EMAIL_FROM) {
      logger.warn('EMAIL_FROM not set; skipping email send');
      return;
    }
    try {
      await EmailService.transporter.sendMail({
        from: env.EMAIL_FROM,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
    } catch (err) {
      logger.warn({ err }, 'Failed to send email');
    }
  }
}


