"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const crypto_1 = __importDefault(require("crypto"));
const database_1 = require("../config/database");
const jwt_1 = require("../utils/jwt");
const router = (0, express_1.Router)();
router.post('/register', async (req, res) => {
    try {
        const { phone, name, email, password } = req.body;
        if (!phone || !name || !email || !password) {
            return res.status(400).json({
                error: 'All fields are required: phone, name, email, password'
            });
        }
        const existingUser = await database_1.pool.query('SELECT id FROM users WHERE email = $1 OR phone = $2', [email, phone]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                error: 'User with this email or phone already exists'
            });
        }
        const saltRounds = 10;
        const hashedPassword = await bcrypt_1.default.hash(password, saltRounds);
        const result = await database_1.pool.query('INSERT INTO users (phone, name, email, password, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id, phone, name, email, created_at', [phone, name, email, hashedPassword]);
        const newUser = result.rows[0];
        res.status(201).json({
            message: 'User registered successfully',
            user: newUser
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                error: 'Email and password are required'
            });
        }
        const userResult = await database_1.pool.query('SELECT id, email, password FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const user = userResult.rows[0];
        const isValidPassword = await bcrypt_1.default.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const tokenId = (0, jwt_1.generateTokenId)();
        const accessToken = (0, jwt_1.generateAccessToken)(user.id, user.email);
        const refreshToken = (0, jwt_1.generateRefreshToken)(user.id, tokenId);
        const tokenHash = crypto_1.default.createHash('sha256').update(refreshToken).digest('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await database_1.pool.query('INSERT INTO refresh_tokens (token_id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)', [tokenId, user.id, tokenHash, expiresAt]);
        res.json({
            message: 'Login successful',
            accessToken,
            refreshToken,
            expiresIn: 3600
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token is required' });
        }
        let decoded;
        try {
            decoded = (0, jwt_1.verifyRefreshToken)(refreshToken);
        }
        catch (error) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }
        const tokenHash = crypto_1.default.createHash('sha256').update(refreshToken).digest('hex');
        const tokenResult = await database_1.pool.query('SELECT user_id, expires_at, is_revoked FROM refresh_tokens WHERE token_id = $1 AND token_hash = $2', [decoded.tokenId, tokenHash]);
        if (tokenResult.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }
        const tokenData = tokenResult.rows[0];
        if (tokenData.is_revoked) {
            return res.status(401).json({ error: 'Refresh token has been revoked' });
        }
        if (new Date() > new Date(tokenData.expires_at)) {
            await database_1.pool.query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE token_id = $1', [decoded.tokenId]);
            return res.status(401).json({ error: 'Refresh token has expired' });
        }
        const userResult = await database_1.pool.query('SELECT id, email FROM users WHERE id = $1', [tokenData.user_id]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }
        const user = userResult.rows[0];
        const newAccessToken = (0, jwt_1.generateAccessToken)(user.id, user.email);
        res.json({
            message: 'Token refreshed successfully',
            accessToken: newAccessToken,
            expiresIn: 3600
        });
    }
    catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/logout', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token is required' });
        }
        let decoded;
        try {
            decoded = (0, jwt_1.verifyRefreshToken)(refreshToken);
        }
        catch (error) {
            return res.status(400).json({ error: 'Invalid refresh token' });
        }
        await database_1.pool.query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE token_id = $1', [decoded.tokenId]);
        res.json({ message: 'Logged out successfully' });
    }
    catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map