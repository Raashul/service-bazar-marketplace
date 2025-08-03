export interface BuyerPreference {
  id: string;
  buyer_id: string;
  preference_text: string;
  extracted_keywords: string[];
  extracted_category?: string;
  extracted_subcategory?: string;
  extracted_subsubcategory?: string;
  min_price?: number;
  max_price?: number;
  currency: string;
  listing_type?: 'product' | 'service';
  location_data?: {
    mapbox_id?: string;
    full_address: string;
    latitude: number;
    longitude: number;
    place_name: string;
    district?: string;
    region?: string;
    country: string;
  };
  status: 'active' | 'inactive' | 'paused';
  created_at: Date;
  updated_at: Date;
  last_matched_at?: Date;
  match_count: number;
}

export interface CreateBuyerPreferenceRequest {
  preference_text: string;
  location_data?: {
    mapbox_id?: string;
    full_address: string;
    latitude: number;
    longitude: number;
    place_name: string;
    district?: string;
    region?: string;
    country: string;
  };
}

export interface UpdateBuyerPreferenceRequest {
  preference_text?: string;
  location_data?: {
    mapbox_id?: string;
    full_address: string;
    latitude: number;
    longitude: number;
    place_name: string;
    district?: string;
    region?: string;
    country: string;
  };
  status?: 'active' | 'inactive' | 'paused';
}

export interface BuyerPreferenceResponse {
  id: string;
  preference_text: string;
  extracted_keywords: string[];
  extracted_category?: string;
  extracted_subcategory?: string;
  extracted_subsubcategory?: string;
  min_price?: number;
  max_price?: number;
  currency: string;
  listing_type?: 'product' | 'service';
  location_data?: {
    mapbox_id?: string;
    full_address: string;
    latitude: number;
    longitude: number;
    place_name: string;
    district?: string;
    region?: string;
    country: string;
  };
  status: 'active' | 'inactive' | 'paused';
  created_at: Date;
  updated_at: Date;
  match_count: number;
}