"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const sendgrid_1 = require("../utils/sendgrid");
const router = (0, express_1.Router)();
// Send initial message to seller about a product
router.post("/", async (req, res) => {
    try {
        const { product_id, buyer_id, message } = req.body;
        if (!product_id || !buyer_id || !message) {
            return res.status(400).json({
                error: "Required fields: product_id, buyer_id, message",
            });
        }
        if (message.trim().length < 10) {
            return res.status(400).json({
                error: "Message must be at least 10 characters long",
            });
        }
        if (message.trim().length > 1000) {
            return res.status(400).json({
                error: "Message must be less than 1000 characters",
            });
        }
        // Check if product exists and get seller info
        const productResult = await database_1.pool.query(`
      SELECT p.*, u.name as seller_name, u.email as seller_email, u.phone as seller_phone
      FROM products p 
      JOIN users u ON p.seller_id = u.id 
      WHERE p.id = $1 AND p.status = 'active' AND p.expires_at > NOW()
    `, [product_id]);
        if (productResult.rows.length === 0) {
            return res
                .status(404)
                .json({ error: "Product not found or no longer available" });
        }
        const product = productResult.rows[0];
        // Check if buyer exists
        const buyerResult = await database_1.pool.query("SELECT id, name, email, phone FROM users WHERE id = $1", [buyer_id]);
        if (buyerResult.rows.length === 0) {
            return res.status(400).json({ error: "Invalid buyer_id" });
        }
        const buyer = buyerResult.rows[0];
        // Prevent seller from messaging themselves
        if (buyer_id === product.seller_id) {
            return res
                .status(400)
                .json({ error: "You cannot message yourself about your own product" });
        }
        // Check if this buyer has already sent an initial message for this product
        const existingMessage = await database_1.pool.query("SELECT id FROM messages WHERE product_id = $1 AND buyer_id = $2 AND seller_id = $3", [product_id, buyer_id, product.seller_id]);
        // if (existingMessage.rows.length > 0) {
        //   return res.status(409).json({
        //     error: 'You have already sent an initial message about this product'
        //   });
        // }
        // Insert the message
        const messageResult = await database_1.pool.query(`
      INSERT INTO messages (product_id, buyer_id, seller_id, message, is_initial_message, created_at)
      VALUES ($1, $2, $3, $4, true, NOW())
      RETURNING *
    `, [product_id, buyer_id, product.seller_id, message.trim()]);
        const newMessage = messageResult.rows[0];
        // Prepare email data
        const messageWithDetails = {
            ...newMessage,
            buyer_name: buyer.name,
            buyer_email: buyer.email,
            buyer_phone: buyer.phone,
            seller_name: product.seller_name,
            seller_email: product.seller_email,
            seller_phone: product.seller_phone,
            product_title: product.title,
            product_description: product.description,
            product_price: parseFloat(product.price),
            product_currency: product.currency,
            product_category: product.category,
            product_subcategory: product.subcategory,
            product_subsubcategory: product.subsubcategory,
            product_location: product.location,
            product_images: [],
        };
        // Send email notification to seller with enhanced error handling
        const emailResult = await (0, sendgrid_1.sendBuyerMessageNotificationWithRetry)(messageWithDetails);
        // Update message to track detailed email status and error information
        await database_1.pool.query(`UPDATE messages SET 
       email_sent = $1, 
       email_error = $2, 
       email_error_type = $3, 
       email_attempts = $4, 
       email_message_id = $5 
       WHERE id = $6`, [
            emailResult.success,
            emailResult.error || null,
            emailResult.errorType || null,
            3, // Default to 3 attempts for retry mechanism
            emailResult.messageId || null,
            newMessage.id,
        ]);
        res.status(201).json({
            message: "Initial message sent successfully",
            data: {
                id: newMessage.id,
                product_id: newMessage.product_id,
                buyer_id: newMessage.buyer_id,
                seller_id: newMessage.seller_id,
                message: newMessage.message,
                email_sent: emailResult.success,
                email_status: emailResult.success ? "delivered" : "failed",
                email_error: emailResult.error || null,
                email_error_type: emailResult.errorType || null,
                created_at: newMessage.created_at,
            },
        });
    }
    catch (error) {
        console.error("Send message error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Get messages for a specific product (for seller to see who's interested)
router.get("/product/:productId", async (req, res) => {
    try {
        const { productId } = req.params;
        const { seller_id } = req.query;
        if (!seller_id) {
            return res
                .status(400)
                .json({ error: "seller_id query parameter is required" });
        }
        // Verify seller owns the product
        const productCheck = await database_1.pool.query("SELECT seller_id FROM products WHERE id = $1", [productId]);
        if (productCheck.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }
        if (productCheck.rows[0].seller_id !== seller_id) {
            return res
                .status(403)
                .json({ error: "Not authorized to view messages for this product" });
        }
        // Get all messages for this product with acceptance status
        const messagesResult = await database_1.pool.query(`
      SELECT m.*, u.name as buyer_name, u.email as buyer_email, u.phone as buyer_phone,
             p.title as product_title
      FROM messages m
      JOIN users u ON m.buyer_id = u.id
      JOIN products p ON m.product_id = p.id
      WHERE m.product_id = $1
      ORDER BY 
        CASE m.status 
          WHEN 'pending' THEN 1 
          WHEN 'accepted' THEN 2 
          WHEN 'rejected' THEN 3 
        END,
        m.created_at DESC
    `, [productId]);
        res.json({
            messages: messagesResult.rows,
            total: messagesResult.rows.length,
        });
    }
    catch (error) {
        console.error("Get product messages error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Get all messages for a buyer (to see what they've inquired about)
router.get("/buyer/:buyerId", async (req, res) => {
    try {
        const { buyerId } = req.params;
        // Get all messages sent by this buyer with acceptance status
        const messagesResult = await database_1.pool.query(`
      SELECT m.*, 
             p.title as product_title, p.price, p.currency, p.status as product_status,
             u.name as seller_name, u.email as seller_email, u.phone as seller_phone
      FROM messages m
      JOIN products p ON m.product_id = p.id
      JOIN users u ON m.seller_id = u.id
      WHERE m.buyer_id = $1
      ORDER BY 
        CASE m.status 
          WHEN 'accepted' THEN 1 
          WHEN 'pending' THEN 2 
          WHEN 'rejected' THEN 3 
        END,
        m.created_at DESC
    `, [buyerId]);
        res.json({
            messages: messagesResult.rows,
            total: messagesResult.rows.length,
        });
    }
    catch (error) {
        console.error("Get buyer messages error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Seller responds to a message (accept/reject) - Tinder-style matching
router.put("/respond", async (req, res) => {
    try {
        const { message_id, seller_id, status } = req.body;
        if (!message_id || !seller_id || !status) {
            return res.status(400).json({
                error: "Required fields: message_id, seller_id, status",
            });
        }
        if (!['accepted', 'rejected'].includes(status)) {
            return res.status(400).json({
                error: "Status must be either 'accepted' or 'rejected'",
            });
        }
        // Check if message exists and seller owns the product
        const messageResult = await database_1.pool.query(`
      SELECT m.*, p.title as product_title, p.seller_id as product_seller_id,
             u.name as buyer_name, u.email as buyer_email, u.phone as buyer_phone
      FROM messages m
      JOIN products p ON m.product_id = p.id
      JOIN users u ON m.buyer_id = u.id
      WHERE m.id = $1
    `, [message_id]);
        if (messageResult.rows.length === 0) {
            return res.status(404).json({ error: "Message not found" });
        }
        const message = messageResult.rows[0];
        // Verify seller owns the product
        if (message.product_seller_id !== seller_id) {
            return res.status(403).json({
                error: "Not authorized to respond to this message",
            });
        }
        // Check if already responded
        if (message.status !== 'pending') {
            return res.status(409).json({
                error: `Message has already been ${message.status}`,
            });
        }
        // Update message status
        const updateResult = await database_1.pool.query(`UPDATE messages 
       SET status = $1, responded_at = NOW() 
       WHERE id = $2 
       RETURNING *`, [status, message_id]);
        const updatedMessage = updateResult.rows[0];
        // TODO: Send notification email to buyer about acceptance/rejection
        res.json({
            message: `Message ${status} successfully`,
            data: {
                id: updatedMessage.id,
                product_id: updatedMessage.product_id,
                buyer_id: updatedMessage.buyer_id,
                seller_id: updatedMessage.seller_id,
                status: updatedMessage.status,
                responded_at: updatedMessage.responded_at,
                buyer_name: message.buyer_name,
                buyer_email: message.buyer_email,
                buyer_phone: message.buyer_phone,
                product_title: message.product_title,
            },
        });
    }
    catch (error) {
        console.error("Message response error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
exports.default = router;
//# sourceMappingURL=messages.js.map