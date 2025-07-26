export interface ProductImage {
  id: string; // UUID
  product_id: string; // UUID
  s3_key: string;
  s3_url: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  display_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface ProductImageWithSignedUrl extends ProductImage {
  signed_url: string;
}

export interface ImageUploadResult {
  success: boolean;
  image?: ProductImage;
  error?: string;
}

export interface ImageUploadRequest {
  product_id: string;
  display_order?: number;
}

export interface SetPreviewImageRequest {
  product_id: string;
  image_id: string;
}

export interface ImageDeleteRequest {
  product_id: string;
  image_id: string;
}

export interface ImageReorderRequest {
  product_id: string;
  image_orders: {
    image_id: string;
    display_order: number;
  }[];
}