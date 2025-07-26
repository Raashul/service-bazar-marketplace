export interface Message {
    id: number;
    product_id: number;
    buyer_id: number;
    seller_id: number;
    message: string;
    is_initial_message: boolean;
    email_sent: boolean;
    created_at: Date;
}
export interface CreateMessageRequest {
    product_id: number;
    buyer_id: number;
    message: string;
}
export interface MessageWithDetails extends Message {
    buyer_name: string;
    buyer_email: string;
    buyer_phone: string;
    seller_name: string;
    seller_email: string;
    seller_phone: string;
    product_title: string;
    product_description: string;
    product_price: number;
    product_currency: string;
    product_category: string;
    product_subcategory: string;
    product_subsubcategory: string;
    product_location: string;
    product_images: string[];
}
//# sourceMappingURL=Message.d.ts.map