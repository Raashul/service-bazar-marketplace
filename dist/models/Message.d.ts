export interface Message {
    id: string;
    product_id: string;
    buyer_id: string;
    seller_id: string;
    message: string;
    is_initial_message: boolean;
    email_sent: boolean;
    status: 'pending' | 'accepted' | 'rejected';
    responded_at?: Date;
    created_at: Date;
}
export interface CreateMessageRequest {
    product_id: string;
    buyer_id: string;
    message: string;
}
export interface MessageResponseRequest {
    message_id: string;
    seller_id: string;
    status: 'accepted' | 'rejected';
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