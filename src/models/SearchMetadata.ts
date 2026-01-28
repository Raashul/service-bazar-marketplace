export interface SearchMetadata {
  // Text search fields
  keywords?: string[];

  // Brand/Model detection for specific searches
  brands?: string[];        // Specific brands mentioned (e.g., ["Mercedes", "BMW"])
  model?: string;           // Specific model if mentioned (e.g., "iPhone 16 Pro", "C-Class")
  is_specific_search?: boolean;  // True if specific brand/model is mentioned

  // Listing type
  listing_type?: 'product' | 'service';

  // Price filters
  min_price?: number;
  max_price?: number;
  currency?: string;

  // Category filters
  category?: string;
  subcategory?: string;
  subsubcategory?: string;

  // Product attributes
  condition?: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  features?: string[]; // Things like "1TB", "rose gold", "16GB RAM"

  // Service-specific attributes
  service_type?: string; // e.g., "makeup", "tutoring", "repair"
  availability?: string; // e.g., "weekends", "evenings", "flexible"
  experience_level?: string; // e.g., "beginner", "professional", "expert"

  // Search preferences
  is_negotiable?: boolean;
}

export interface NaturalLanguageSearchRequest {
  query: string;
  location_data?: {
    mapbox_id?: string;
    full_address: string;
    latitude: number;
    longitude: number;
    place_name: string;
    district?: string;
    region?: string;
    country: string;
  }; // Optional Mapbox location data from search box
  limit?: number;
  page?: number;
}

export interface NaturalLanguageSearchResponse {
  products: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}