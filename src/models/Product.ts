export interface Product {
  id: string; // UUID
  seller_id: string; // UUID
  title: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  subcategory: string;
  subsubcategory: string;
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  location: string;
  tags: string[];
  is_negotiable: boolean;
  expires_at: Date;
  status: 'active' | 'sold' | 'expired' | 'removed';
  preview_image_id?: string; // UUID of preview image
  image_count: number;
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
  location: string;
  tags?: string[];
  is_negotiable?: boolean;
  expires_in_days?: number; // Default to 30 days if not provided
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
  location?: string;
  tags?: string[];
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
  location?: string;
  search?: string; // Search in title/description
  tags?: string;
  status?: 'active' | 'sold' | 'expired';
  page?: number;
  limit?: number;
}