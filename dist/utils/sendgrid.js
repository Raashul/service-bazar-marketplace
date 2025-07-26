"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendBuyerMessageNotificationLegacy = exports.sendBuyerMessageNotificationWithRetry = exports.sendEmailWithRetry = exports.sendBuyerMessageNotification = exports.generateBuyerMessageEmailTemplate = exports.sendEmailLegacy = exports.sendEmail = exports.isValidEmail = void 0;
const mail_1 = __importDefault(require("@sendgrid/mail"));
// Initialize SendGrid with API key
if (process.env.SENDGRID_API_KEY) {
    mail_1.default.setApiKey(process.env.SENDGRID_API_KEY);
}
else {
    console.warn('SENDGRID_API_KEY not found in environment variables');
}
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};
exports.isValidEmail = isValidEmail;
const sendEmail = async (emailData) => {
    try {
        // Configuration validation
        if (!process.env.SENDGRID_API_KEY) {
            console.log('SendGrid not configured - email would be sent:', emailData.subject);
            return {
                success: false,
                error: 'SendGrid API key not configured',
                errorType: 'CONFIGURATION'
            };
        }
        if (!process.env.FROM_EMAIL) {
            return {
                success: false,
                error: 'FROM_EMAIL not configured',
                errorType: 'CONFIGURATION'
            };
        }
        // Email validation
        if (!(0, exports.isValidEmail)(emailData.to)) {
            return {
                success: false,
                error: `Invalid recipient email: ${emailData.to}`,
                errorType: 'VALIDATION'
            };
        }
        if (!(0, exports.isValidEmail)(process.env.FROM_EMAIL)) {
            return {
                success: false,
                error: `Invalid sender email: ${process.env.FROM_EMAIL}`,
                errorType: 'VALIDATION'
            };
        }
        // Content validation
        if (!emailData.subject || emailData.subject.trim().length === 0) {
            return {
                success: false,
                error: 'Email subject is required',
                errorType: 'VALIDATION'
            };
        }
        if (!emailData.html || emailData.html.trim().length === 0) {
            return {
                success: false,
                error: 'Email content is required',
                errorType: 'VALIDATION'
            };
        }
        const msg = {
            to: emailData.to,
            from: process.env.FROM_EMAIL,
            subject: emailData.subject,
            text: emailData.text || emailData.html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
            html: emailData.html,
        };
        const response = await mail_1.default.send(msg);
        console.log(`Email sent successfully to ${emailData.to}`);
        return {
            success: true,
            statusCode: response[0].statusCode,
            messageId: response[0].headers['x-message-id']
        };
    }
    catch (error) {
        console.error('SendGrid error details:', {
            message: error.message,
            code: error.code,
            statusCode: error.response?.status,
            body: error.response?.body
        });
        let errorType = 'UNKNOWN';
        let errorMessage = 'Unknown email sending error';
        if (error.code) {
            switch (error.code) {
                case 'ENOTFOUND':
                case 'ECONNREFUSED':
                case 'ETIMEDOUT':
                    errorType = 'NETWORK';
                    errorMessage = 'Network connection error to SendGrid';
                    break;
                default:
                    errorType = 'SENDGRID_API';
                    errorMessage = error.message || 'SendGrid API error';
            }
        }
        else if (error.response) {
            errorType = 'SENDGRID_API';
            // Parse SendGrid specific errors
            if (error.response.status === 400) {
                errorMessage = 'Bad request - check email format and content';
            }
            else if (error.response.status === 401) {
                errorMessage = 'Invalid SendGrid API key';
            }
            else if (error.response.status === 403) {
                errorMessage = 'SendGrid API access forbidden - check permissions';
            }
            else if (error.response.status === 413) {
                errorMessage = 'Email content too large';
            }
            else if (error.response.status === 429) {
                errorMessage = 'SendGrid rate limit exceeded';
            }
            else if (error.response.status >= 500) {
                errorMessage = 'SendGrid server error - try again later';
            }
            else {
                errorMessage = `SendGrid API error: ${error.response.status}`;
            }
        }
        return {
            success: false,
            error: errorMessage,
            errorType,
            statusCode: error.response?.status
        };
    }
};
exports.sendEmail = sendEmail;
// Legacy function for backward compatibility
const sendEmailLegacy = async (emailData) => {
    const result = await (0, exports.sendEmail)(emailData);
    return result.success;
};
exports.sendEmailLegacy = sendEmailLegacy;
const generateBuyerMessageEmailTemplate = (messageDetails) => {
    const { buyer_name, message, product_title, product_description, product_price, product_currency, product_category, product_subcategory, product_subsubcategory, product_location, product_images, buyer_email, buyer_phone } = messageDetails;
    const categoryPath = [product_category, product_subcategory, product_subsubcategory]
        .filter(cat => cat && cat.trim() !== '')
        .join(' > ');
    const firstImage = product_images && product_images.length > 0 ? product_images[0] : '';
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Message About Your Listing</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .header { background-color: #007bff; color: white; padding: 20px; border-radius: 8px 8px 0 0; margin: -20px -20px 20px; }
            .product-card { border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin: 15px 0; background-color: #f9f9f9; }
            .product-image { max-width: 100%; height: 200px; object-fit: cover; border-radius: 4px; margin-bottom: 10px; }
            .price { font-size: 24px; color: #28a745; font-weight: bold; }
            .category { background-color: #e9ecef; padding: 5px 10px; border-radius: 15px; font-size: 12px; color: #6c757d; display: inline-block; }
            .message-box { background-color: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 15px 0; }
            .buyer-info { background-color: #f8f9fa; padding: 10px; border-radius: 4px; margin: 10px 0; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>💬 New Message About Your Listing!</h1>
                <p>Someone is interested in your item</p>
            </div>

            <div class="product-card">
                <h2>📦 Your Listing Details</h2>
                ${firstImage ? `<img src="${firstImage}" alt="${product_title}" class="product-image">` : ''}
                <h3>${product_title}</h3>
                <p><strong>Price:</strong> <span class="price">${product_currency} ${product_price}</span></p>
                <p><strong>Category:</strong> <span class="category">${categoryPath}</span></p>
                <p><strong>Location:</strong> ${product_location}</p>
                <p><strong>Description:</strong> ${product_description}</p>
            </div>

            <div class="message-box">
                <h3>💭 Message from Potential Buyer:</h3>
                <p><em>"${message}"</em></p>
            </div>

            <div class="buyer-info">
                <h3>👤 Buyer Contact Information:</h3>
                <p><strong>Name:</strong> ${buyer_name}</p>
                <p><strong>Email:</strong> <a href="mailto:${buyer_email}">${buyer_email}</a></p>
                <p><strong>Phone:</strong> <a href="tel:${buyer_phone}">${buyer_phone}</a></p>
            </div>

            <div style="text-align: center; margin: 20px 0;">
                <p><strong>💡 What's Next?</strong></p>
                <p>Reply directly to the buyer using their contact information above, or log into your marketplace account to respond.</p>
            </div>

            <div class="footer">
                <p>This email was sent because someone expressed interest in your marketplace listing. If you no longer wish to receive these notifications, please update your account settings.</p>
                <p><strong>LLM Marketplace</strong> - Connecting buyers and sellers</p>
            </div>
        </div>
    </body>
    </html>
  `;
};
exports.generateBuyerMessageEmailTemplate = generateBuyerMessageEmailTemplate;
const sendBuyerMessageNotification = async (messageDetails) => {
    const emailData = {
        to: messageDetails.seller_email,
        subject: `💬 New message about "${messageDetails.product_title}" - LLM Marketplace`,
        html: (0, exports.generateBuyerMessageEmailTemplate)(messageDetails)
    };
    return await (0, exports.sendEmail)(emailData);
};
exports.sendBuyerMessageNotification = sendBuyerMessageNotification;
// Retry mechanism for failed emails
const sendEmailWithRetry = async (emailData, maxRetries = 3, retryDelay = 1000) => {
    let lastResult;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`Email attempt ${attempt}/${maxRetries} to ${emailData.to}`);
        lastResult = await (0, exports.sendEmail)(emailData);
        if (lastResult.success) {
            if (attempt > 1) {
                console.log(`Email succeeded on retry attempt ${attempt}`);
            }
            return lastResult;
        }
        // Don't retry on configuration or validation errors
        if (lastResult.errorType === 'CONFIGURATION' || lastResult.errorType === 'VALIDATION') {
            console.log(`Not retrying due to ${lastResult.errorType} error: ${lastResult.error}`);
            return lastResult;
        }
        // Don't retry on certain HTTP errors
        if (lastResult.statusCode === 401 || lastResult.statusCode === 403) {
            console.log(`Not retrying due to authorization error: ${lastResult.statusCode}`);
            return lastResult;
        }
        if (attempt < maxRetries) {
            console.log(`Email failed (${lastResult.error}), retrying in ${retryDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            retryDelay *= 2; // Exponential backoff
        }
    }
    console.log(`Email failed after ${maxRetries} attempts`);
    return lastResult;
};
exports.sendEmailWithRetry = sendEmailWithRetry;
const sendBuyerMessageNotificationWithRetry = async (messageDetails, maxRetries = 3) => {
    const emailData = {
        to: messageDetails.seller_email,
        subject: `💬 New message about "${messageDetails.product_title}" - LLM Marketplace`,
        html: (0, exports.generateBuyerMessageEmailTemplate)(messageDetails)
    };
    return await (0, exports.sendEmailWithRetry)(emailData, maxRetries);
};
exports.sendBuyerMessageNotificationWithRetry = sendBuyerMessageNotificationWithRetry;
// Legacy function for backward compatibility
const sendBuyerMessageNotificationLegacy = async (messageDetails) => {
    const result = await (0, exports.sendBuyerMessageNotification)(messageDetails);
    return result.success;
};
exports.sendBuyerMessageNotificationLegacy = sendBuyerMessageNotificationLegacy;
//# sourceMappingURL=sendgrid.js.map