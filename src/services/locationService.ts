import { pool } from '../config/database';

// Location data structure for Mapbox responses
export interface LocationData {
  mapbox_id?: string;
  full_address: string;
  latitude: number;
  longitude: number;
  place_name: string;
  district?: string;
  region?: string;
  country: string;
}

// Search center for location queries
export interface SearchCenter {
  latitude: number;
  longitude: number;
  place_name: string;
  search_radius_km: number;
}

export class LocationService {
  private DEFAULT_SEARCH_RADIUS_KM = 3; // 3km default for Nepal cities
  
  /**
   * For testing purposes - simulate Mapbox geocoding
   * In production, this would call actual Mapbox Geocoding API
   */
  async geocodeLocation(locationQuery: string): Promise<LocationData | null> {
    // Sample Nepal locations for testing
    const sampleLocations: Record<string, LocationData> = {
      'thamel': {
        full_address: 'Thamel, Kathmandu 44600, Nepal',
        latitude: 27.7172,
        longitude: 85.3240,
        place_name: 'Thamel',
        district: 'Kathmandu',
        region: 'Bagmati Province',
        country: 'Nepal'
      },
      'basundhara': {
        full_address: 'Basundhara, Kathmandu 44600, Nepal', 
        latitude: 27.7322,
        longitude: 85.3654,
        place_name: 'Basundhara',
        district: 'Kathmandu',
        region: 'Bagmati Province',
        country: 'Nepal'
      },
      'patan': {
        full_address: 'Patan, Lalitpur 44700, Nepal',
        latitude: 27.6744,
        longitude: 85.3250,
        place_name: 'Patan',
        district: 'Lalitpur',
        region: 'Bagmati Province', 
        country: 'Nepal'
      },
      'bhaktapur': {
        full_address: 'Bhaktapur, Bhaktapur 44800, Nepal',
        latitude: 27.6710,
        longitude: 85.4298,
        place_name: 'Bhaktapur',
        district: 'Bhaktapur',
        region: 'Bagmati Province',
        country: 'Nepal'
      },
      'kathmandu': {
        full_address: 'Kathmandu, Nepal',
        latitude: 27.7172,
        longitude: 85.3240,
        place_name: 'Kathmandu',
        district: 'Kathmandu',
        region: 'Bagmati Province',
        country: 'Nepal'
      },
      'lalitpur': {
        full_address: 'Lalitpur, Nepal',
        latitude: 27.6588,
        longitude: 85.3247,
        place_name: 'Lalitpur',
        district: 'Lalitpur',
        region: 'Bagmati Province',
        country: 'Nepal'
      },
      'pokhara': {
        full_address: 'Pokhara, Gandaki Province, Nepal',
        latitude: 28.2380,
        longitude: 83.9956,
        place_name: 'Pokhara',
        district: 'Kaski',
        region: 'Gandaki Province',
        country: 'Nepal'
      }
    };

    const normalizedQuery = locationQuery.toLowerCase().trim();
    return sampleLocations[normalizedQuery] || null;
  }

  /**
   * Find products within radius of a location
   */
  async searchProductsWithinRadius(
    centerLat: number,
    centerLng: number,
    radiusKm: number,
    otherFilters: any = {}
  ) {
    try {
      // Base query with location radius search
      let query = `
        SELECT p.*, u.name as seller_name, u.email as seller_email, u.phone as seller_phone,
               SQRT(
                 POW(69.1 * (p.latitude - $2), 2) + 
                 POW(69.1 * ($1 - p.longitude) * COS(p.latitude / 57.3), 2)
               ) as distance_km
        FROM products p
        JOIN users u ON p.seller_id = u.id
        WHERE p.status = 'active' 
          AND p.expires_at > NOW()
          AND p.latitude IS NOT NULL 
          AND p.longitude IS NOT NULL
          AND (
            -- Simple distance calculation without PostGIS (approximation)
            SQRT(
              POW(69.1 * (p.latitude - $2), 2) + 
              POW(69.1 * ($1 - p.longitude) * COS(p.latitude / 57.3), 2)
            ) <= $3
          )
      `;

      const queryParams: any[] = [centerLng, centerLat, radiusKm];
      let paramCount = 3;

      // Add other filters (keywords, price, etc.)
      if (otherFilters.keywords && otherFilters.keywords.length > 0) {
        const keywordConditions: string[] = [];
        
        otherFilters.keywords.forEach((keyword: string) => {
          paramCount++;
          keywordConditions.push(`(
            p.title ILIKE $${paramCount} OR 
            p.description ILIKE $${paramCount} OR
            EXISTS (
              SELECT 1 FROM unnest(p.enriched_tags) as enriched_tag 
              WHERE enriched_tag ILIKE $${paramCount}
            )
          )`);
          queryParams.push(`%${keyword}%`);
        });

        if (keywordConditions.length > 0) {
          query += ` AND (${keywordConditions.join(' OR ')})`;
        }
      }

      if (otherFilters.listing_type) {
        paramCount++;
        query += ` AND p.listing_type = $${paramCount}`;
        queryParams.push(otherFilters.listing_type);
      }

      if (otherFilters.min_price !== undefined) {
        paramCount++;
        query += ` AND p.price >= $${paramCount}`;
        queryParams.push(otherFilters.min_price);
      }

      if (otherFilters.max_price !== undefined) {
        paramCount++;
        query += ` AND p.price <= $${paramCount}`;
        queryParams.push(otherFilters.max_price);
      }

      // Order by distance (closest first)
      query += ` ORDER BY distance_km ASC`;

      // Add pagination
      const limit = otherFilters.limit || 20;
      const page = otherFilters.page || 1;
      const offset = (page - 1) * limit;

      paramCount++;
      query += ` LIMIT $${paramCount}`;
      queryParams.push(limit);

      paramCount++;
      query += ` OFFSET $${paramCount}`;
      queryParams.push(offset);

      console.log('🌍 Location-based search query:', query);
      console.log('🌍 Query parameters:', queryParams);

      const result = await pool.query(query, queryParams);
      return result.rows;

    } catch (error) {
      console.error('Error in location-based search:', error);
      throw error;
    }
  }

  /**
   * Parse location from search query and return search center
   */
  async parseLocationFromQuery(query: string): Promise<SearchCenter | null> {
    // Extract location from queries like:
    // "iPhone near Basundhara"
    // "makeup artist in Thamel" 
    // "laptop Kathmandu"
    
    const locationPatterns = [
      /(?:near|around|close to)\s+([a-zA-Z\s]+)/i,
      /(?:in|at)\s+([a-zA-Z\s]+)/i,
      /([a-zA-Z\s]+)$/i // Location at end of query
    ];

    for (const pattern of locationPatterns) {
      const match = query.match(pattern);
      if (match) {
        const locationName = match[1].trim();
        const locationData = await this.geocodeLocation(locationName);
        
        if (locationData) {
          return {
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            place_name: locationData.place_name,
            search_radius_km: this.DEFAULT_SEARCH_RADIUS_KM
          };
        }
      }
    }

    return null;
  }

  /**
   * Get count of products within radius
   */
  async getLocationSearchCount(
    centerLat: number,
    centerLng: number, 
    radiusKm: number,
    otherFilters: any = {}
  ): Promise<number> {
    try {
      let query = `
        SELECT COUNT(*) as total
        FROM products p
        WHERE p.status = 'active' 
          AND p.expires_at > NOW()
          AND p.latitude IS NOT NULL 
          AND p.longitude IS NOT NULL
          AND (
            -- Simple distance calculation without PostGIS (approximation)
            SQRT(
              POW(69.1 * (p.latitude - $2), 2) + 
              POW(69.1 * ($1 - p.longitude) * COS(p.latitude / 57.3), 2)
            ) <= $3
          )
      `;

      const queryParams: any[] = [centerLng, centerLat, radiusKm];
      let paramCount = 3;

      // Add same filters as main search
      if (otherFilters.keywords && otherFilters.keywords.length > 0) {
        const keywordConditions: string[] = [];
        
        otherFilters.keywords.forEach((keyword: string) => {
          paramCount++;
          keywordConditions.push(`(
            p.title ILIKE $${paramCount} OR 
            p.description ILIKE $${paramCount} OR
            EXISTS (
              SELECT 1 FROM unnest(p.enriched_tags) as enriched_tag 
              WHERE enriched_tag ILIKE $${paramCount}
            )
          )`);
          queryParams.push(`%${keyword}%`);
        });

        if (keywordConditions.length > 0) {
          query += ` AND (${keywordConditions.join(' OR ')})`;
        }
      }

      if (otherFilters.listing_type) {
        paramCount++;
        query += ` AND p.listing_type = $${paramCount}`;
        queryParams.push(otherFilters.listing_type);
      }

      const result = await pool.query(query, queryParams);
      return parseInt(result.rows[0].total);

    } catch (error) {
      console.error('Error getting location search count:', error);
      return 0;
    }
  }

  /**
   * Validate location data from Mapbox
   */
  validateLocationData(locationData: any): LocationData | null {
    if (!locationData || 
        typeof locationData.latitude !== 'number' ||
        typeof locationData.longitude !== 'number' ||
        !locationData.place_name ||
        !locationData.full_address) {
      return null;
    }

    return {
      mapbox_id: locationData.mapbox_id || null,
      full_address: locationData.full_address,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      place_name: locationData.place_name,
      district: locationData.district || null,
      region: locationData.region || null,
      country: locationData.country || 'Nepal'
    };
  }
}

export default new LocationService();