export interface TokenPayload {
    userId: number;
    email: string;
}
export interface RefreshTokenPayload {
    userId: number;
    tokenId: string;
}
export declare const generateAccessToken: (payload: TokenPayload) => string;
export declare const generateRefreshToken: (payload: RefreshTokenPayload) => string;
export declare const verifyAccessToken: (token: string) => TokenPayload;
export declare const verifyRefreshToken: (token: string) => RefreshTokenPayload;
export declare const generateTokenId: () => string;
//# sourceMappingURL=jwt.d.ts.map