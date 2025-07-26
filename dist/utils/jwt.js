"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTokenId = exports.verifyRefreshToken = exports.verifyAccessToken = exports.generateRefreshToken = exports.generateAccessToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const generateAccessToken = (payload) => {
    return jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET, {
        expiresIn: '1h',
        issuer: 'llm-marketplace',
        audience: 'llm-marketplace-users'
    });
};
exports.generateAccessToken = generateAccessToken;
const generateRefreshToken = (payload) => {
    return jsonwebtoken_1.default.sign(payload, process.env.REFRESH_SECRET, {
        expiresIn: '7d',
        issuer: 'llm-marketplace',
        audience: 'llm-marketplace-users'
    });
};
exports.generateRefreshToken = generateRefreshToken;
const verifyAccessToken = (token) => {
    return jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET, {
        issuer: 'llm-marketplace',
        audience: 'llm-marketplace-users'
    });
};
exports.verifyAccessToken = verifyAccessToken;
const verifyRefreshToken = (token) => {
    return jsonwebtoken_1.default.verify(token, process.env.REFRESH_SECRET, {
        issuer: 'llm-marketplace',
        audience: 'llm-marketplace-users'
    });
};
exports.verifyRefreshToken = verifyRefreshToken;
const generateTokenId = () => {
    return crypto_1.default.randomBytes(32).toString('hex');
};
exports.generateTokenId = generateTokenId;
//# sourceMappingURL=jwt.js.map