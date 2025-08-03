import axios from 'axios';

interface MapboxSearchResponse {
  suggestions: MapboxSuggestion[];
  attribution: string;
}

interface MapboxSuggestion {
  name: string;
  mapbox_id: string;
  feature_type: string;
  address?: string;
  full_address?: string;
  place_formatted?: string;
  context: {
    country?: {
      name: string;
      country_code?: string;
      country_code_alpha_3?: string;
    };
    region?: {
      name: string;
      region_code?: string;
      region_code_full?: string;
    };
    postcode?: {
      name: string;
    };
    district?: {
      name: string;
    };
    locality?: {
      name: string;
    };
    place?: {
      name: string;
    };
    neighborhood?: {
      name: string;
    };
    street?: {
      name: string;
    };
  };
  language?: string;
  maki?: string;
  poi_category?: string[];
  poi_category_ids?: string[];
  external_ids?: {
    [key: string]: string;
  };
  metadata?: {
    [key: string]: any;
  };
}

interface MapboxRetrieveResponse {
  type: string;
  features: MapboxFeature[];
}

interface MapboxFeature {
  id: string;
  type: string;
  geometry: {
    type: string;
    coordinates: [number, number]; // [longitude, latitude]
  };
  properties: {
    name: string;
    mapbox_id: string;
    feature_type: string;
    address?: string;
    full_address?: string;
    place_formatted?: string;
    context: {
      country?: {
        name: string;
        country_code?: string;
        country_code_alpha_3?: string;
      };
      region?: {
        name: string;
        region_code?: string;
        region_code_full?: string;
      };
      postcode?: {
        name: string;
      };
      district?: {
        name: string;
      };
      locality?: {
        name: string;
      };
      place?: {
        name: string;
      };
      neighborhood?: {
        name: string;
      };
      street?: {
        name: string;
      };
    };
    coordinates: [number, number];
    [key: string]: any;
  };
}

interface LocationData {
  mapbox_id?: string;
  full_address: string;
  latitude: number;
  longitude: number;
  place_name: string;
  district?: string;
  region?: string;
  country: string;
}

class MapboxService {
  private accessToken: string;
  private searchUrl = 'https://api.mapbox.com/search/searchbox/v1';

  constructor() {
    this.accessToken = process.env.MAPBOX_ACCESS_TOKEN || '';
    if (!this.accessToken || this.accessToken === 'your_mapbox_access_token_here') {
      console.warn('Warning: MAPBOX_ACCESS_TOKEN not properly configured');
    }
  }

  /**
   * Search for locations using Mapbox Search API v1
   * @param query - Search query (e.g., "thamel", "kathmandu")
   * @param limit - Maximum number of results (default: 5)
   * @param proximity - Bias results around a location [lng, lat]
   * @param country - Country code to restrict results (e.g., "np" for Nepal)
   */
  async searchLocations(
    query: string, 
    limit: number = 5,
    proximity?: [number, number],
    country?: string
  ): Promise<MapboxSearchResponse> {
    try {
      if (!this.accessToken || this.accessToken === 'your_mapbox_access_token_here') {
        throw new Error('Mapbox access token not configured');
      }

      const params = new URLSearchParams({
        q: query,
        access_token: this.accessToken,
        limit: limit.toString(),
        session_token: `search_${Date.now()}`, // Required for search API
        types: 'place,locality,neighborhood,address'
      });

      // Add proximity if provided (bias results around a location)
      if (proximity) {
        params.append('proximity', `${proximity[0]},${proximity[1]}`);
      }

      // Add country restriction if provided
      if (country) {
        params.append('country', country);
      }

      const url = `${this.searchUrl}/suggest?${params.toString()}`;

      console.log(`🗺️ Mapbox Search API request: ${url.replace(this.accessToken, 'TOKEN_HIDDEN')}`);

      const response = await axios.get<MapboxSearchResponse>(url, {
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'LLM-Marketplace-Service/1.0'
        }
      });

      return response.data;

    } catch (error) {
      console.error('Mapbox Search API error:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
          throw new Error('Unable to connect to Mapbox API');
        }
        if (error.response?.status === 401) {
          throw new Error('Invalid Mapbox access token');
        }
        if (error.response?.status === 429) {
          throw new Error('Mapbox API rate limit exceeded');
        }
        throw new Error(`Mapbox API error: ${error.response?.status || error.message}`);
      }
      
      throw new Error('Unknown error occurred while fetching locations');
    }
  }

  /**
   * Get detailed information about a specific place by its Mapbox ID
   */
  async getLocationById(mapboxId: string): Promise<MapboxFeature | null> {
    try {
      if (!this.accessToken || this.accessToken === 'your_mapbox_access_token_here') {
        throw new Error('Mapbox access token not configured');
      }

      const params = new URLSearchParams({
        access_token: this.accessToken,
        session_token: `retrieve_${Date.now()}` // Required for retrieve API
      });

      const url = `${this.searchUrl}/retrieve/${encodeURIComponent(mapboxId)}?${params.toString()}`;
      
      console.log(`🗺️ Mapbox retrieve API request: ${url.replace(this.accessToken, 'TOKEN_HIDDEN')}`);

      const response = await axios.get<MapboxRetrieveResponse>(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'LLM-Marketplace-Service/1.0'
        }
      });

      return response.data.features[0] || null;

    } catch (error) {
      console.error('Mapbox retrieve API error:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          return null; // Location not found
        }
        if (error.response?.status === 401) {
          throw new Error('Invalid Mapbox access token');
        }
      }
      
      throw new Error('Error looking up location by ID');
    }
  }

  /**
   * Convert Mapbox suggestion to our LocationData format
   */
  convertSuggestionToLocationData(suggestion: MapboxSuggestion): LocationData {
    return {
      mapbox_id: suggestion.mapbox_id,
      full_address: suggestion.full_address || suggestion.place_formatted || suggestion.name,
      latitude: 0, // Will be filled when we retrieve full details
      longitude: 0, // Will be filled when we retrieve full details
      place_name: suggestion.name,
      district: suggestion.context.district?.name || suggestion.context.locality?.name,
      region: suggestion.context.region?.name,
      country: suggestion.context.country?.name || 'Unknown Country'
    };
  }

  /**
   * Convert Mapbox feature (from retrieve API) to our LocationData format
   */
  convertFeatureToLocationData(feature: MapboxFeature): LocationData {
    return {
      mapbox_id: feature.properties.mapbox_id,
      full_address: feature.properties.full_address || feature.properties.place_formatted || feature.properties.name,
      latitude: feature.geometry.coordinates[1], // Mapbox uses [lng, lat]
      longitude: feature.geometry.coordinates[0],
      place_name: feature.properties.name,
      district: feature.properties.context.district?.name || feature.properties.context.locality?.name,
      region: feature.properties.context.region?.name,
      country: feature.properties.context.country?.name || 'Unknown Country'
    };
  }

  /**
   * Check if Mapbox Search API is properly configured and accessible
   */
  async healthCheck(): Promise<{ status: string; message: string; }> {
    try {
      if (!this.accessToken || this.accessToken === 'your_mapbox_access_token_here') {
        return {
          status: 'error',
          message: 'Mapbox access token not configured'
        };
      }

      // Try a simple search request
      await this.searchLocations('Nepal', 1);
      
      return {
        status: 'ok',
        message: 'Mapbox Search API is accessible'
      };

    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export default new MapboxService();