import { Pool } from 'pg';
import { BuyerPreference } from '../models/BuyerPreference';
import { Product } from '../models/Product';
import { ProductSnapshot } from '../models/Match';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

interface MatchResult {
  preference: BuyerPreference;
  score: number;
  matchReasons: string[];
}


/**
 * Calculate distance between two coordinates in kilometers
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Calculate match score between a buyer preference and a new product
 * Note: Basic criteria (listing_type, category, subcategory, price) are pre-filtered by DB query
 */
function calculateMatchScore(preference: BuyerPreference, product: Product): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const maxScore = 100;

  // Base score for DB-filtered criteria (60 points total)
  // These are guaranteed matches since they passed the DB filter
  
  // 1. Listing Type Match (20 points) - Guaranteed by DB filter
  score += 20;
  reasons.push(`✓ Listing type match: ${product.listing_type}`);

  // 2. Category Hierarchy Match (40 points) - Guaranteed by DB filter
  if (preference.extracted_category) {
    score += 20;
    reasons.push(`✓ Category match: ${product.category}`);
    
    if (preference.extracted_subcategory) {
      score += 15;
      reasons.push(`✓ Subcategory match: ${product.subcategory}`);
      
      if (preference.extracted_subsubcategory) {
        score += 5;
        reasons.push(`✓ Sub-subcategory match: ${product.subsubcategory}`);
      }
    }
  } else {
    // If no category preference, give partial points for flexibility
    score += 15;
    reasons.push(`○ No category preference (flexible)`);
  }

  // 3. Price Assessment (bonus points based on how good the deal is)
  const productPrice = typeof product.price === 'string' ? parseFloat(product.price) : product.price;
  
  if (preference.max_price) {
    // Calculate how good the deal is within budget
    const budgetUtilization = productPrice / preference.max_price;
    if (budgetUtilization <= 0.8) {
      // Great deal - under 80% of budget
      score += 10;
      reasons.push(`✓ Excellent value: ${productPrice} (${(budgetUtilization * 100).toFixed(0)}% of budget)`);
    } else if (budgetUtilization <= 1.0) {
      // Good deal - within budget
      score += 5;
      reasons.push(`✓ Within budget: ${productPrice} <= ${preference.max_price} ${preference.currency}`);
    }
  } else if (preference.min_price && productPrice >= preference.min_price) {
    score += 5;
    reasons.push(`✓ Above minimum price: ${productPrice} >= ${preference.min_price} ${preference.currency}`);
  } else {
    score += 3;
    reasons.push(`○ No price constraint specified`);
  }

  // 4. Keyword/Tags Similarity (30 points) - Key differentiator
  const preferenceKeywords = preference.extracted_keywords || [];
  const productTags = product.enriched_tags || [];
  
  if (preferenceKeywords.length > 0 && productTags.length > 0) {
    // Find matching keywords (case insensitive, partial matching)
    const matches = preferenceKeywords.filter(prefKeyword => 
      productTags.some(productTag => 
        productTag.toLowerCase().includes(prefKeyword.toLowerCase()) ||
        prefKeyword.toLowerCase().includes(productTag.toLowerCase())
      )
    );
    
    const matchRatio = matches.length / preferenceKeywords.length;
    let keywordScore = 0;
    
    if (matchRatio >= 0.8) {
      keywordScore = 30; // Excellent keyword match
    } else if (matchRatio >= 0.6) {
      keywordScore = 25; // Good keyword match
    } else if (matchRatio >= 0.4) {
      keywordScore = 20; // Fair keyword match
    } else if (matchRatio >= 0.2) {
      keywordScore = 15; // Some keyword match
    } else if (matches.length > 0) {
      keywordScore = 10; // Minimal keyword match
    } else {
      keywordScore = 0; // No keyword match
    }
    
    score += keywordScore;
    
    if (matches.length > 0) {
      reasons.push(`✓ Keyword matches (${matches.length}/${preferenceKeywords.length}): ${matches.join(', ')}`);
    } else {
      reasons.push(`○ No keyword matches found`);
    }
  } else {
    // Award some points if no keywords specified (flexible preference)
    score += 10;
    reasons.push(`○ No keyword constraints (flexible)`);
  }

  // 5. Location Proximity (10 points) - Pre-filtered but calculate exact distance bonus
  if (preference.location_data && product.latitude && product.longitude) {
    const productLat = typeof product.latitude === 'string' ? parseFloat(product.latitude) : product.latitude;
    const productLng = typeof product.longitude === 'string' ? parseFloat(product.longitude) : product.longitude;
    
    const distance = calculateDistance(
      preference.location_data.latitude,
      preference.location_data.longitude,
      productLat,
      productLng
    );
    
    // Award points based on proximity (already pre-filtered to ~11km radius)
    if (distance <= 1) {
      score += 10; // Very close
      reasons.push(`✓ Excellent location: ${distance.toFixed(1)}km away`);
    } else if (distance <= 3) {
      score += 8; // Close
      reasons.push(`✓ Great location: ${distance.toFixed(1)}km away`);
    } else if (distance <= 5) {
      score += 6; // Reasonable
      reasons.push(`✓ Good location: ${distance.toFixed(1)}km away`);
    } else {
      score += 3; // Within bounding box but farther
      reasons.push(`○ Acceptable location: ${distance.toFixed(1)}km away`);
    }
  } else {
    score += 5; // No location constraint = partial points
    reasons.push(`○ No location preference specified`);
  }

  return { score: Math.min(score, maxScore), reasons };
}

/**
 * Find matching buyer preferences for a new product using optimized filtering
 */
export async function findMatchingPreferences(product: Product): Promise<MatchResult[]> {
  try {
    const productPrice = typeof product.price === 'string' ? parseFloat(product.price) : product.price;
    
    // Build optimized query with WHERE conditions to filter candidates
    let whereConditions = ['bp.status = $1']; // $1 = 'active'
    let queryParams: any[] = ['active'];
    let paramIndex = 2;

    // 1. Filter by listing type (must match)
    if (product.listing_type) {
      whereConditions.push(`(bp.listing_type IS NULL OR bp.listing_type = $${paramIndex})`);
      queryParams.push(product.listing_type);
      paramIndex++;
    }

    // 2. Filter by category (exact match or null for flexible preferences)
    if (product.category) {
      whereConditions.push(`(bp.extracted_category IS NULL OR bp.extracted_category = $${paramIndex})`);
      queryParams.push(product.category);
      paramIndex++;
    }

    // 3. Filter by subcategory (exact match or null)
    if (product.subcategory) {
      whereConditions.push(`(bp.extracted_subcategory IS NULL OR bp.extracted_subcategory = $${paramIndex})`);
      queryParams.push(product.subcategory);
      paramIndex++;
    }

    // 4. Filter by sub-subcategory (exact match or null)
    if (product.subsubcategory) {
      whereConditions.push(`(bp.extracted_subsubcategory IS NULL OR bp.extracted_subsubcategory = $${paramIndex})`);
      queryParams.push(product.subsubcategory);
      paramIndex++;
    }

    // 5. Filter by price constraints
    // Include preferences with no max_price OR where product price <= max_price
    whereConditions.push(`(bp.max_price IS NULL OR $${paramIndex} <= bp.max_price)`);
    queryParams.push(productPrice);
    paramIndex++;

    // Include preferences with no min_price OR where product price >= min_price  
    whereConditions.push(`(bp.min_price IS NULL OR $${paramIndex} >= bp.min_price)`);
    queryParams.push(productPrice);
    paramIndex++;

    // 6. Optional: Filter by location proximity (if both have location data)
    // This is complex in SQL, so we'll do basic filtering and detailed distance calculation later
    if (product.latitude && product.longitude) {
      // Rough bounding box filter (±0.1 degrees ≈ ~11km)
      const latBuffer = 0.1;
      const lngBuffer = 0.1;
      const productLat = typeof product.latitude === 'string' ? parseFloat(product.latitude) : product.latitude;
      const productLng = typeof product.longitude === 'string' ? parseFloat(product.longitude) : product.longitude;
      
      whereConditions.push(`(
        bp.location_data IS NULL OR 
        (
          (bp.location_data->>'latitude')::float BETWEEN $${paramIndex} AND $${paramIndex + 1} AND
          (bp.location_data->>'longitude')::float BETWEEN $${paramIndex + 2} AND $${paramIndex + 3}
        )
      )`);
      
      queryParams.push(
        productLat - latBuffer,  // min lat
        productLat + latBuffer,  // max lat  
        productLng - lngBuffer,  // min lng
        productLng + lngBuffer   // max lng
      );
      paramIndex += 4;
    }

    const query = `
      SELECT bp.* 
      FROM buyer_preferences bp
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY bp.created_at DESC
      LIMIT 50
    `;
    
    console.log(`🔍 Optimized query with ${whereConditions.length} conditions:`, {
      listing_type: product.listing_type,
      category: product.category,
      subcategory: product.subcategory,
      subsubcategory: product.subsubcategory,
      price: productPrice,
      has_location: !!(product.latitude && product.longitude)
    });
    
    const result = await pool.query(query, queryParams);
    const preferences: BuyerPreference[] = result.rows;
    
    console.log(`🔍 Found ${preferences.length} potentially matching buyer preferences (after DB filtering)`);
    
    const matches: MatchResult[] = [];
    const MATCH_THRESHOLD = 60; // Minimum score to consider a match
    
    for (const preference of preferences) {
      const { score, reasons } = calculateMatchScore(preference, product);
      
      console.log(`📊 Preference "${preference.preference_text}" scored ${score}/100`);
      console.log(`   Reasons: ${reasons.join('; ')}`);
      
      if (score >= MATCH_THRESHOLD) {
        matches.push({
          preference,
          score,
          matchReasons: reasons
        });
        
        console.log(`✅ MATCH FOUND! Score: ${score}/100`);
      }
    }
    
    // Sort by score (highest first)
    matches.sort((a, b) => b.score - a.score);
    
    console.log(`🎯 Found ${matches.length} matching preferences with score >= ${MATCH_THRESHOLD}`);
    
    return matches;

  } catch (error) {
    console.error('Error finding matching preferences:', error);
    return [];
  }
}


/**
 * Create a product snapshot for storing in match table
 */
async function createProductSnapshot(product: Product): Promise<ProductSnapshot> {
  try {
    // Get seller information
    const sellerQuery = 'SELECT name, email, phone FROM users WHERE id = $1';
    const sellerResult = await pool.query(sellerQuery, [product.seller_id]);
    const seller = sellerResult.rows[0];

    if (!seller) {
      throw new Error(`Seller not found for product ${product.id}`);
    }

    const snapshot: ProductSnapshot = {
      id: product.id,
      title: product.title,
      description: product.description,
      price: typeof product.price === 'string' ? product.price : product.price.toString(),
      currency: product.currency,
      category: product.category,
      subcategory: product.subcategory,
      subsubcategory: product.subsubcategory,
      condition: product.condition,
      location: product.location,
      listing_type: product.listing_type,
      enriched_tags: product.enriched_tags,
      is_negotiable: product.is_negotiable,
      status: product.status,
      seller_info: {
        seller_id: product.seller_id,
        seller_name: seller.name,
        seller_email: seller.email,
        seller_phone: seller.phone
      },
      created_at: product.created_at,
      expires_at: product.expires_at
    };

    // Add location info if available
    if (product.latitude && product.longitude) {
      snapshot.location_info = {
        mapbox_id: product.mapbox_id,
        full_address: product.full_address,
        latitude: typeof product.latitude === 'string' ? parseFloat(product.latitude) : product.latitude,
        longitude: typeof product.longitude === 'string' ? parseFloat(product.longitude) : product.longitude,
        place_name: product.place_name,
        district: product.district,
        region: product.region,
        country: product.country
      };
    }

    return snapshot;

  } catch (error) {
    console.error('Error creating product snapshot:', error);
    throw error;
  }
}

/**
 * Generate concise match reason highlighting key factors
 */
function generateMatchReason(match: MatchResult, product: Product): string {
  const reasons: string[] = [];
  const productPrice = typeof product.price === 'string' ? parseFloat(product.price) : product.price;
  
  // Price highlight
  if (match.preference.max_price) {
    const budgetUtilization = productPrice / match.preference.max_price;
    if (budgetUtilization <= 0.8) {
      reasons.push(`Great deal at ${productPrice} ${product.currency} (20% under budget)`);
    } else {
      reasons.push(`Within budget at ${productPrice} ${product.currency}`);
    }
  }

  // Category match
  if (product.subcategory) {
    reasons.push(`${product.subcategory} match`);
  } else if (product.category) {
    reasons.push(`${product.category} match`);
  }

  // Condition (if available and relevant)
  if (product.listing_type === 'product' && product.condition !== 'new') {
    const conditionLabel = product.condition.replace('_', ' ');
    reasons.push(`${conditionLabel} condition`);
  }

  // Keyword highlights (top 2)
  if (match.preference.extracted_keywords && product.enriched_tags) {
    const keywordMatches = match.preference.extracted_keywords.filter(prefKeyword => 
      product.enriched_tags.some(productTag => 
        productTag.toLowerCase().includes(prefKeyword.toLowerCase()) ||
        prefKeyword.toLowerCase().includes(productTag.toLowerCase())
      )
    ).slice(0, 2); // Only top 2 keywords

    if (keywordMatches.length > 0) {
      reasons.push(`matches: ${keywordMatches.join(', ')}`);
    }
  }

  // Location (if relevant)
  if (match.preference.location_data && product.latitude && product.longitude) {
    const productLat = typeof product.latitude === 'string' ? parseFloat(product.latitude) : product.latitude;
    const productLng = typeof product.longitude === 'string' ? parseFloat(product.longitude) : product.longitude;
    
    const distance = calculateDistance(
      match.preference.location_data.latitude,
      match.preference.location_data.longitude,
      productLat,
      productLng
    );
    
    if (distance <= 3) {
      reasons.push(`nearby (${distance.toFixed(1)}km)`);
    }
  }

  return reasons.join(' • ');
}

/**
 * Store match in database instead of sending email
 */
async function storeMatch(match: MatchResult, product: Product): Promise<boolean> {
  try {
    // Create product snapshot
    const productSnapshot = await createProductSnapshot(product);

    // Generate concise match reason
    const matchReason = generateMatchReason(match, product);

    console.log(`💾 STORING MATCH
Preference: "${match.preference.preference_text}"
Product: ${product.title}
Score: ${match.score}/100
Reason: ${matchReason}
    `);

    // Insert match into database
    const insertQuery = `
      INSERT INTO buyer_preference_matches 
      (preference_id, buyer_id, product_id, match_score, match_reason, product_snapshot, product_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (preference_id, product_id) DO NOTHING
      RETURNING id
    `;

    const result = await pool.query(insertQuery, [
      match.preference.id,
      match.preference.buyer_id,
      product.id,
      match.score,
      matchReason,
      JSON.stringify(productSnapshot),
      product.status || 'active'
    ]);

    if (result.rows.length > 0) {
      console.log(`✅ Match stored successfully with ID: ${result.rows[0].id}`);
      
      // Update preference match tracking
      await pool.query(
        'UPDATE buyer_preferences SET last_matched_at = CURRENT_TIMESTAMP, match_count = match_count + 1 WHERE id = $1',
        [match.preference.id]
      );

      return true;
    } else {
      console.log(`ℹ️ Match already exists for preference ${match.preference.id} and product ${product.id}`);
      return false;
    }

  } catch (error) {
    console.error('Error storing match:', error);
    return false;
  }
}

/**
 * Process matches and store them in database
 */
export async function processMatches(product: Product): Promise<void> {
  try {
    console.log(`🚀 Processing matches for new product: ${product.title}`);
    
    const matches = await findMatchingPreferences(product);
    
    if (matches.length === 0) {
      console.log(`😔 No matches found for product: ${product.title}`);
      return;
    }

    console.log(`🎉 Found ${matches.length} matches, storing them...`);

    let storedCount = 0;
    let duplicateCount = 0;

    for (const match of matches) {
      const success = await storeMatch(match, product);
      
      if (success) {
        storedCount++;
      } else {
        duplicateCount++;
      }
      
      // Small delay to avoid overwhelming database
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log(`✅ Stored ${storedCount} new matches, ${duplicateCount} duplicates skipped`);

  } catch (error) {
    console.error('Error processing matches:', error);
  }
}