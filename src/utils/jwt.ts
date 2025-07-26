import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export interface TokenPayload {
  sub: string; // user_id as UUID (industry standard)
  userId: string; // UUID (for backward compatibility)
  email: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export interface RefreshTokenPayload {
  sub: string; // user_id as UUID (industry standard)
  userId: string; // UUID (for backward compatibility)
  tokenId: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export const generateAccessToken = (userId: string, email: string): string => {
  const payload: TokenPayload = {
    sub: userId, // Industry standard - subject claim
    userId: userId, // Backward compatibility
    email: email
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: '1h',
    issuer: 'llm-marketplace',
    audience: 'llm-marketplace-users'
  });
};

export const generateRefreshToken = (userId: string, tokenId: string): string => {
  const payload: RefreshTokenPayload = {
    sub: userId, // Industry standard - subject claim
    userId: userId, // Backward compatibility
    tokenId: tokenId
  };
  
  return jwt.sign(payload, process.env.REFRESH_SECRET!, {
    expiresIn: '7d',
    issuer: 'llm-marketplace',
    audience: 'llm-marketplace-users'
  });
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, process.env.JWT_SECRET!, {
    issuer: 'llm-marketplace',
    audience: 'llm-marketplace-users'
  }) as TokenPayload;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  return jwt.verify(token, process.env.REFRESH_SECRET!, {
    issuer: 'llm-marketplace',
    audience: 'llm-marketplace-users'
  }) as RefreshTokenPayload;
};

export const generateTokenId = (): string => {
  return crypto.randomBytes(32).toString('hex');
};