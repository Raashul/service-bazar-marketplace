export interface User {
    id: number;
    phone: string;
    name: string;
    email: string;
    password: string;
    created_at: Date;
    updated_at: Date;
}
export interface CreateUserRequest {
    phone: string;
    name: string;
    email: string;
    password: string;
}
//# sourceMappingURL=User.d.ts.map