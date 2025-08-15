export interface Match {
  id: string;
  preference_id: string;
  buyer_id: string;
  product_id: string;
  match_score: number;
  match_reason: string;
  product_snapshot: ProductSnapshot;
  status: 'new' | 'viewed' | 'interested' | 'contacted' | 'dismissed';
  product_status: 'active' | 'sold' | 'expired' | 'removed';
  matched_at: Date;
  viewed_at?: Date;
  updated_at: Date;
  product_status_updated_at?: Date;
}

export interface ProductSnapshot {
  id: string;
  title: string;
  description: string;
  price: string;
  currency: string;
  category: string;
  subcategory: string;
  subsubcategory?: string;
  condition: string;
  location: string;
  listing_type: 'product' | 'service';
  enriched_tags: string[];
  is_negotiable: boolean;
  status: string;
  seller_info: {
    seller_id: string;
    seller_name: string;
    seller_email: string;
    seller_phone: string;
  };
  location_info?: {
    mapbox_id?: string;
    full_address?: string;
    latitude?: number;
    longitude?: number;
    place_name?: string;
    district?: string;
    region?: string;
    country?: string;
  };
  created_at: Date;
  expires_at: Date;
}

export interface MatchResponse {
  id: string;
  preference_id: string;
  preference_text: string;
  match_score: number;
  match_reason: string;
  product_snapshot: ProductSnapshot;
  status: 'new' | 'viewed' | 'interested' | 'contacted' | 'dismissed';
  product_status: 'active' | 'sold' | 'expired' | 'removed';
  matched_at: Date;
  viewed_at?: Date;
  product_status_updated_at?: Date;
  is_product_available: boolean; // Whether the original product is still active
  availability_info: {
    status: 'active' | 'sold' | 'expired' | 'removed';
    message: string;
    alternative_actions: string[];
  };
}

export interface CreateMatchRequest {
  preference_id: string;
  buyer_id: string;
  product_id: string;
  match_score: number;
  match_reason: string;
  product_snapshot: ProductSnapshot;
}

export interface UpdateMatchRequest {
  status?: 'viewed' | 'interested' | 'contacted' | 'dismissed';
}