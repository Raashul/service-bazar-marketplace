/**
 * LLM Marketplace API Types
 *
 * Use these TypeScript types in your frontend application
 * for type-safe API integration.
 */

// ============================================
// Common Types
// ============================================

export type UUID = string;

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  data?: T[];
}

// ============================================
// Authentication
// ============================================

export interface RegisterRequest {
  phone: string;
  name: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  message: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  message: string;
  accessToken: string;
  expiresIn: number;
}

export interface LogoutRequest {
  refreshToken: string;
}

// ============================================
// User
// ============================================

export interface User {
  id: UUID;
  phone: string;
  name: string;
  email: string;
  created_at: string;
  updated_at?: string;
}

// ============================================
// Location
// ============================================

export interface LocationData {
  mapbox_id?: string;
  full_address: string;
  latitude: number;
  longitude: number;
  place_name: string;
  district?: string;
  region: string;
  country: string;
}

export interface LocationSearchParams {
  q: string;
  limit?: number;
  country?: string;
  proximity?: string; // "lng,lat"
}

export interface LocationSearchResponse {
  suggestions: LocationData[];
  query: string;
  attribution: string;
}

// ============================================
// Product
// ============================================

export type ProductCondition = 'new' | 'like_new' | 'good' | 'fair' | 'poor';
export type ProductStatus = 'active' | 'sold' | 'expired' | 'removed';
export type ListingType = 'product' | 'service';

export interface Product {
  id: UUID;
  seller_id: UUID;
  title: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  subcategory: string | null;
  subsubcategory: string | null;
  condition: ProductCondition;
  location: string;
  listing_type: ListingType;
  enriched_tags: string[];
  is_negotiable: boolean;
  status: ProductStatus;
  preview_image_id: UUID | null;
  expires_at: string;
  // Location fields
  mapbox_id: string | null;
  full_address: string | null;
  latitude: number | null;
  longitude: number | null;
  place_name: string | null;
  district: string | null;
  region: string | null;
  country: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductWithSeller extends Product {
  seller_name: string;
  seller_phone: string;
  seller_email?: string;
  product_images: ProductImage[];
}

export interface CreateProductRequest {
  seller_id: UUID;
  title: string;
  description: string;
  price: number;
  currency?: string;
  category: string;
  subcategory?: string;
  subsubcategory?: string;
  condition: ProductCondition;
  location?: string;
  location_data?: LocationData;
  listing_type?: ListingType;
  is_negotiable?: boolean;
  expires_in_days?: number;
}

export interface CreateProductResponse {
  message: string;
  product: Product;
  content_cleaning: {
    title_changes_applied: boolean;
    method: string;
    original_title: string;
    description_preserved: boolean;
    note: string;
  };
  location_info?: LocationData;
}

export interface UpdateProductRequest {
  seller_id: UUID;
  title?: string;
  description?: string;
  price?: number;
  currency?: string;
  category?: string;
  subcategory?: string;
  subsubcategory?: string;
  condition?: ProductCondition;
  location?: string;
  is_negotiable?: boolean;
  expires_in_days?: number;
}

export interface ProductSearchParams extends PaginationParams {
  category?: string;
  subcategory?: string;
  subsubcategory?: string;
  min_price?: number;
  max_price?: number;
  condition?: ProductCondition;
  location?: string;
  search?: string;
  status?: ProductStatus;
}

export interface ProductListResponse {
  products: ProductWithSeller[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface NaturalSearchRequest {
  query: string;
  location_data?: LocationData;
  limit?: number;
  page?: number;
}

export interface NaturalSearchResponse {
  products: ProductWithSeller[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UpdateProductStatusRequest {
  status: ProductStatus;
  reason?: string;
}

export interface ContentCleaningPreviewRequest {
  title: string;
  description?: string;
}

export interface ContentCleaningPreviewResponse {
  preview: {
    original: string;
    cleaned: string;
    changes_applied: boolean;
    note: string;
  };
  content: {
    title: string;
    description_note: string;
  };
}

export interface EnrichTagsRequest {
  title: string;
  description: string;
  price: number;
}

export interface EnrichTagsResponse {
  enriched_tags: string[];
  count: number;
}

// ============================================
// Product Image
// ============================================

export interface ProductImage {
  id: UUID;
  product_id: UUID;
  s3_key: string;
  s3_url: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  display_order: number;
  created_at: string;
  updated_at: string;
  signed_url?: string;
  is_preview?: boolean;
}

export interface ImageUploadResponse {
  message: string;
  image: ProductImage;
}

export interface MultiImageUploadResponse {
  message: string;
  images: ProductImage[];
  errors?: string[];
}

export interface ImageListResponse {
  images: ProductImage[];
  total: number;
}

export interface SetPreviewRequest {
  product_id: UUID;
  image_id: UUID;
}

export interface ReorderImagesRequest {
  product_id: UUID;
  image_orders: Array<{
    image_id: UUID;
    display_order: number;
  }>;
}

// ============================================
// Buyer Preference
// ============================================

export type PreferenceStatus = 'active' | 'inactive' | 'paused';

export interface BuyerPreference {
  id: UUID;
  buyer_id: UUID;
  preference_text: string;
  extracted_keywords: string[];
  extracted_category: string | null;
  extracted_subcategory: string | null;
  extracted_subsubcategory: string | null;
  min_price: number | null;
  max_price: number | null;
  currency: string;
  listing_type: ListingType | null;
  location_data: LocationData | null;
  status: PreferenceStatus;
  match_count: number;
  last_matched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePreferenceRequest {
  preference_text: string;
  location_data?: LocationData;
}

export interface UpdatePreferenceRequest {
  preference_text?: string;
  location_data?: LocationData;
  status?: PreferenceStatus;
}

export interface PreferenceListParams extends PaginationParams {
  status?: PreferenceStatus;
}

export interface PreferenceListResponse extends PaginatedResponse<BuyerPreference> {
  preferences: BuyerPreference[];
}

// ============================================
// Match
// ============================================

export type MatchStatus = 'new' | 'viewed' | 'interested' | 'contacted' | 'dismissed';

export interface ProductSnapshot {
  id: UUID;
  title: string;
  description: string;
  price: string;
  currency: string;
  category: string;
  subcategory: string | null;
  subsubcategory: string | null;
  condition: ProductCondition;
  location: string;
  listing_type: ListingType;
  enriched_tags: string[];
  is_negotiable: boolean;
  status: ProductStatus;
  seller_info: {
    seller_id: UUID;
    seller_name: string;
    seller_email: string;
    seller_phone: string;
  };
  location_info?: LocationData;
  created_at: string;
  expires_at: string;
}

export interface Match {
  id: UUID;
  preference_id: UUID;
  preference_text: string;
  match_score: number;
  match_reason: string;
  product_snapshot: ProductSnapshot;
  status: MatchStatus;
  product_status: ProductStatus;
  matched_at: string;
  viewed_at: string | null;
  product_status_updated_at: string;
  is_product_available: boolean;
  availability_info: {
    status: string;
    message: string;
    alternative_actions: string[];
  };
}

export interface MatchListParams extends PaginationParams {
  status?: MatchStatus;
  preference_id?: UUID;
  sort?: 'newest' | 'oldest' | 'score';
}

export interface MatchListResponse extends PaginatedResponse<Match> {
  matches: Match[];
  filters: {
    status: string | null;
    preference_id: string | null;
    sort: string;
  };
}

export interface MatchByPreferenceResponse extends PaginatedResponse<Match> {
  preference_text: string;
  matches: Match[];
}

export interface UpdateMatchStatusRequest {
  status: MatchStatus;
}

export interface MatchStats {
  total_matches: number;
  by_match_status: Record<MatchStatus, number>;
  by_product_status: Record<ProductStatus, number>;
  match_quality: {
    avg_score: number;
    best_score: number;
  };
  recent_activity: {
    matches_this_week: number;
    matches_this_month: number;
  };
}

// ============================================
// Message
// ============================================

export type MessageStatus = 'pending' | 'accepted' | 'rejected';

export interface Message {
  id: UUID;
  product_id: UUID;
  buyer_id: UUID;
  seller_id: UUID;
  message: string;
  is_initial_message: boolean;
  email_sent: boolean;
  email_error?: string;
  email_error_type?: string;
  status: MessageStatus;
  responded_at: string | null;
  created_at: string;
}

export interface MessageWithBuyerInfo extends Message {
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  product_title: string;
}

export interface MessageWithSellerInfo extends Message {
  product_title: string;
  price: number;
  currency: string;
  product_status: ProductStatus;
  seller_name: string;
  seller_email: string;
  seller_phone: string;
}

export interface SendMessageRequest {
  product_id: UUID;
  buyer_id: UUID;
  message: string; // 10-1000 characters
}

export interface SendMessageResponse {
  message: string;
  data: {
    id: UUID;
    product_id: UUID;
    buyer_id: UUID;
    seller_id: UUID;
    message: string;
    email_sent: boolean;
    email_status?: string;
    email_error?: string;
    created_at: string;
  };
}

export interface RespondToMessageRequest {
  message_id: UUID;
  seller_id: UUID;
  status: 'accepted' | 'rejected';
}

export interface RespondToMessageResponse {
  message: string;
  data: MessageWithBuyerInfo;
}

export interface SellerMessagesResponse {
  messages: MessageWithBuyerInfo[];
  total: number;
}

export interface BuyerMessagesResponse {
  messages: MessageWithSellerInfo[];
  total: number;
}

// ============================================
// Categories
// ============================================

export type CategoryHierarchy = {
  [category: string]: {
    [subcategory: string]: string[] | null;
  } | null;
};

export interface CategoriesResponse {
  message: string;
  categories: CategoryHierarchy;
}

// ============================================
// Error Response
// ============================================

export interface APIError {
  error: string;
  details?: string;
}

// ============================================
// Health Check
// ============================================

export interface HealthResponse {
  status: 'OK';
  message: string;
}

export interface MapboxHealthResponse {
  status: 'ok' | 'unavailable';
  message: string;
}
