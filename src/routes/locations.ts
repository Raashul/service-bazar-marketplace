import { Router, Request, Response } from "express";
import mapboxService from "../services/mapboxService";

const router = Router();

// Location autocomplete search using Mapbox Geocoding API
router.get("/search", async (req: Request, res: Response) => {
  try {
    const { q, limit = 5, country, proximity } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        error: "Query parameter 'q' is required"
      });
    }

    const query = q.trim();
    
    if (query.length < 1) {
      return res.status(400).json({
        error: "Query must be at least 1 character long"
      });
    }

    // Parse proximity if provided (format: "lng,lat")
    let proximityCoords: [number, number] | undefined;
    if (proximity && typeof proximity === 'string') {
      const coords = proximity.split(',').map(Number);
      if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
        proximityCoords = [coords[0], coords[1]];
      }
    }

    // Call Mapbox Search API
    const mapboxResponse = await mapboxService.searchLocations(
      query,
      Number(limit),
      proximityCoords,
      country as string
    );

    // Transform suggestions to match location_data schema for direct reuse
    const suggestions = await Promise.all(
      mapboxResponse.suggestions.map(async (suggestion) => {
        try {
          // Get detailed location data with coordinates
          const detailedFeature = await mapboxService.getLocationById(suggestion.mapbox_id);
          
          if (detailedFeature) {
            // Return in location_data format that matches NaturalLanguageSearchRequest
            return {
              mapbox_id: suggestion.mapbox_id,
              full_address: suggestion.full_address || suggestion.place_formatted || suggestion.name,
              latitude: detailedFeature.geometry.coordinates[1], // Mapbox uses [lng, lat]
              longitude: detailedFeature.geometry.coordinates[0],
              place_name: suggestion.name,
              district: suggestion.context.district?.name || suggestion.context.locality?.name,
              region: suggestion.context.region?.name,
              country: suggestion.context.country?.name || 'Unknown Country'
            };
          } else {
            // Fallback without coordinates (should be rare)
            console.warn(`Could not get coordinates for ${suggestion.mapbox_id}, skipping`);
            return null;
          }
        } catch (error) {
          console.warn(`Failed to get details for ${suggestion.mapbox_id}:`, error);
          return null;
        }
      })
    );

    // Filter out failed suggestions and return clean array
    const validSuggestions = suggestions.filter(s => s !== null);

    res.json({
      suggestions: validSuggestions,
      query: query,
      attribution: mapboxResponse.attribution || "Mapbox Search API"
    });

  } catch (error) {
    console.error("Mapbox search error:", error);
    
    if (error instanceof Error) {
      if (error.message.includes('not configured')) {
        return res.status(503).json({ 
          error: "Location service not configured",
          details: "Mapbox API token not available"
        });
      }
      if (error.message.includes('rate limit')) {
        return res.status(429).json({ 
          error: "Too many requests",
          details: "Please try again later"
        });
      }
      if (error.message.includes('Invalid')) {
        return res.status(503).json({ 
          error: "Location service configuration error",
          details: "Invalid API credentials"
        });
      }
    }
    
    res.status(500).json({ 
      error: "Location search failed",
      details: "Unable to fetch location data"
    });
  }
});

// Get location details by Mapbox ID
router.get("/:mapbox_id", async (req: Request, res: Response) => {
  try {
    const { mapbox_id } = req.params;

    if (!mapbox_id) {
      return res.status(400).json({ error: "Mapbox ID is required" });
    }

    const feature = await mapboxService.getLocationById(mapbox_id);

    if (!feature) {
      return res.status(404).json({ error: "Location not found" });
    }

    res.json({
      ...feature,
      location_data: mapboxService.convertFeatureToLocationData(feature)
    });

  } catch (error) {
    console.error("Get location error:", error);
    
    if (error instanceof Error && error.message.includes('not configured')) {
      return res.status(503).json({ 
        error: "Location service not configured",
        details: "Mapbox API token not available"
      });
    }
    
    res.status(500).json({ error: "Internal server error" });
  }
});

// Health check endpoint for Mapbox API
router.get("/health/mapbox", async (req: Request, res: Response) => {
  try {
    const health = await mapboxService.healthCheck();
    
    if (health.status === 'ok') {
      res.json(health);
    } else {
      res.status(503).json(health);
    }
    
  } catch (error) {
    console.error("Mapbox health check error:", error);
    res.status(500).json({
      status: 'error',
      message: 'Health check failed'
    });
  }
});

export default router;