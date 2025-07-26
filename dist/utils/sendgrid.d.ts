import { MessageWithDetails } from '../models/Message';
export interface EmailData {
    to: string;
    subject: string;
    html: string;
    text?: string;
}
export interface EmailResult {
    success: boolean;
    error?: string;
    errorType?: 'CONFIGURATION' | 'VALIDATION' | 'SENDGRID_API' | 'NETWORK' | 'UNKNOWN';
    statusCode?: number;
    messageId?: string;
}
export declare const isValidEmail: (email: string) => boolean;
export declare const sendEmail: (emailData: EmailData) => Promise<EmailResult>;
export declare const sendEmailLegacy: (emailData: EmailData) => Promise<boolean>;
export declare const generateBuyerMessageEmailTemplate: (messageDetails: MessageWithDetails) => string;
export declare const sendBuyerMessageNotification: (messageDetails: MessageWithDetails) => Promise<EmailResult>;
export declare const sendEmailWithRetry: (emailData: EmailData, maxRetries?: number, retryDelay?: number) => Promise<EmailResult>;
export declare const sendBuyerMessageNotificationWithRetry: (messageDetails: MessageWithDetails, maxRetries?: number) => Promise<EmailResult>;
export declare const sendBuyerMessageNotificationLegacy: (messageDetails: MessageWithDetails) => Promise<boolean>;
//# sourceMappingURL=sendgrid.d.ts.map