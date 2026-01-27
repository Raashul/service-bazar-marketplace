export interface LocationInfo {
    mapbox_id?: string;
    full_address: string;
    latitude: number;
    longitude: number;
    place_name: string;
    district?: string;
    region?: string;
    country: string;
}
export interface Product {
    id: string;
    seller_id: string;
    title: string;
    description: string;
    price: number;
    currency: string;
    category: string;
    subcategory: string;
    subsubcategory: string;
    condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
    listing_type: 'product' | 'service';
    is_featured: boolean;
    enriched_tags: string[];
    is_negotiable: boolean;
    expires_at: Date;
    status: 'active' | 'sold' | 'expired' | 'removed';
    preview_image_id?: string;
    image_count: number;
    mapbox_id?: string;
    full_address?: string;
    latitude?: number;
    longitude?: number;
    place_name?: string;
    district?: string;
    region?: string;
    country?: string;
    created_at: Date;
    updated_at: Date;
}
export interface ProductWithImages extends Product {
    product_images: Array<{
        id: string;
        original_filename: string;
        signed_url: string;
        display_order: number;
        is_preview: boolean;
    }>;
}
export interface CreateProductRequest {
    title: string;
    description: string;
    price: number;
    currency: string;
    category: string;
    subcategory?: string;
    subsubcategory?: string;
    condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
    location_data?: LocationInfo;
    listing_type?: 'product' | 'service';
    is_featured?: boolean;
    is_negotiable?: boolean;
    expires_in_days?: number;
}
export interface UpdateProductRequest {
    title?: string;
    description?: string;
    price?: number;
    currency?: string;
    category?: string;
    subcategory?: string;
    subsubcategory?: string;
    condition?: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
    listing_type?: 'product' | 'service';
    is_negotiable?: boolean;
    expires_in_days?: number;
}
export interface ProductSearchQuery {
    category?: string;
    subcategory?: string;
    subsubcategory?: string;
    min_price?: number;
    max_price?: number;
    condition?: string;
    search?: string;
    status?: 'active' | 'sold' | 'expired';
    page?: number;
    limit?: number;
}
//# sourceMappingURL=Product.d.ts.map