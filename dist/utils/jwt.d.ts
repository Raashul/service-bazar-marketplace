export interface TokenPayload {
    sub: string;
    userId: string;
    email: string;
    iat?: number;
    exp?: number;
    iss?: string;
    aud?: string;
}
export interface RefreshTokenPayload {
    sub: string;
    userId: string;
    tokenId: string;
    iat?: number;
    exp?: number;
    iss?: string;
    aud?: string;
}
export declare const generateAccessToken: (userId: string, email: string) => string;
export declare const generateRefreshToken: (userId: string, tokenId: string) => string;
export declare const verifyAccessToken: (token: string) => TokenPayload;
export declare const verifyRefreshToken: (token: string) => RefreshTokenPayload;
export declare const generateTokenId: () => string;
//# sourceMappingURL=jwt.d.ts.map