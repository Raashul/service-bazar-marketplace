import { MessageWithDetails } from '../models/Message';
export interface EmailData {
    to: string;
    subject: string;
    html: string;
    text?: string;
}
export declare const sendEmail: (emailData: EmailData) => Promise<boolean>;
export declare const generateBuyerMessageEmailTemplate: (messageDetails: MessageWithDetails) => string;
export declare const sendBuyerMessageNotification: (messageDetails: MessageWithDetails) => Promise<boolean>;
//# sourceMappingURL=sendgrid.d.ts.map