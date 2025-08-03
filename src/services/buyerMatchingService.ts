import { Pool } from 'pg';
import { BuyerPreference } from '../models/BuyerPreference';
import { Product } from '../models/Product';

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

interface BuyerContact {
  buyer_id: string;
  email: string;
  name: string;
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
 */
function calculateMatchScore(preference: BuyerPreference, product: Product): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const maxScore = 100;

  // 1. Listing Type Match (20 points) - Must match
  if (preference.listing_type && preference.listing_type !== product.listing_type) {
    return { score: 0, reasons: [`Listing type mismatch: preference wants ${preference.listing_type}, product is ${product.listing_type}`] };
  }
  if (preference.listing_type === product.listing_type) {
    score += 20;
    reasons.push(`✓ Listing type match: ${product.listing_type}`);
  }

  // 2. Category Match (25 points)
  if (preference.extracted_category && preference.extracted_category === product.category) {
    score += 25;
    reasons.push(`✓ Category match: ${product.category}`);
    
    // Bonus for subcategory match (10 points)
    if (preference.extracted_subcategory && preference.extracted_subcategory === product.subcategory) {
      score += 10;
      reasons.push(`✓ Subcategory match: ${product.subcategory}`);
      
      // Bonus for sub-subcategory match (5 points)
      if (preference.extracted_subsubcategory && preference.extracted_subsubcategory === product.subsubcategory) {
        score += 5;
        reasons.push(`✓ Sub-subcategory match: ${product.subsubcategory}`);
      }
    }
  }

  // 3. Price Compatibility (20 points)
  const productPrice = typeof product.price === 'string' ? parseFloat(product.price) : product.price;
  let priceMatch = false;
  
  if (preference.max_price && productPrice <= preference.max_price) {
    score += 20;
    reasons.push(`✓ Price within budget: ${productPrice} <= ${preference.max_price} ${preference.currency}`);
    priceMatch = true;
  } else if (preference.min_price && productPrice >= preference.min_price) {
    score += 15;
    reasons.push(`✓ Price above minimum: ${productPrice} >= ${preference.min_price} ${preference.currency}`);
    priceMatch = true;
  } else if (!preference.max_price && !preference.min_price) {
    score += 10; // No price constraint = partial points
    reasons.push(`○ No price constraint specified`);
    priceMatch = true;
  }

  if (!priceMatch && preference.max_price && productPrice > preference.max_price) {
    reasons.push(`✗ Price too high: ${productPrice} > ${preference.max_price} ${preference.currency}`);
  }

  // 4. Keyword/Tags Similarity (25 points)
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
    
    const keywordScore = Math.min(25, (matches.length / preferenceKeywords.length) * 25);
    score += keywordScore;
    
    if (matches.length > 0) {
      reasons.push(`✓ Keyword matches (${matches.length}/${preferenceKeywords.length}): ${matches.join(', ')}`);
    } else {
      reasons.push(`○ No direct keyword matches found`);
    }
  }

  // 5. Location Proximity (10 points) - Only if buyer specified location
  if (preference.location_data && product.latitude && product.longitude) {
    const productLat = typeof product.latitude === 'string' ? parseFloat(product.latitude) : product.latitude;
    const productLng = typeof product.longitude === 'string' ? parseFloat(product.longitude) : product.longitude;
    
    const distance = calculateDistance(
      preference.location_data.latitude,
      preference.location_data.longitude,
      productLat,
      productLng
    );
    
    if (distance <= 5) { // Within 5km
      const locationScore = Math.max(0, 10 - (distance * 2)); // Closer = higher score
      score += locationScore;
      reasons.push(`✓ Location nearby: ${distance.toFixed(1)}km from preferred area`);
    } else {
      reasons.push(`○ Location distant: ${distance.toFixed(1)}km from preferred area`);
    }
  } else if (!preference.location_data) {
    score += 5; // No location constraint = partial points
    reasons.push(`○ No location preference specified`);
  }

  return { score: Math.min(score, maxScore), reasons };
}

/**
 * Find matching buyer preferences for a new product
 */
export async function findMatchingPreferences(product: Product): Promise<MatchResult[]> {
  try {
    // Get all active buyer preferences
    const query = `
      SELECT bp.* 
      FROM buyer_preferences bp
      WHERE bp.status = 'active'
      ORDER BY bp.created_at DESC
    `;
    
    const result = await pool.query(query);
    const preferences: BuyerPreference[] = result.rows;
    
    console.log(`🔍 Checking ${preferences.length} active buyer preferences for product: ${product.title}`);
    
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
 * Get buyer contact information for sending notifications
 */
async function getBuyerContact(buyerId: string): Promise<BuyerContact | null> {
  try {
    const query = 'SELECT id, email, name FROM users WHERE id = $1';
    const result = await pool.query(query, [buyerId]);
    
    if (result.rows.length === 0) {
      console.warn(`Buyer not found: ${buyerId}`);
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('Error getting buyer contact:', error);
    return null;
  }
}

/**
 * Send email notification to buyer about matching product
 */
async function sendMatchNotification(match: MatchResult, product: Product, buyer: BuyerContact) {
  try {
    // For now, just log the notification - you can integrate with your email service
    console.log(`
📧 MATCH NOTIFICATION
To: ${buyer.email} (${buyer.name})
Subject: Found a match for your preference!

Hi ${buyer.name},

Great news! We found a product that matches your preference:

Your Preference: "${match.preference.preference_text}"
Match Score: ${match.score}/100

Matching Product:
- Title: ${product.title}
- Price: ${product.price} ${product.currency}
- Location: ${product.location}
- Description: ${product.description}

Why it matches:
${match.matchReasons.map(reason => `• ${reason}`).join('\n')}

View full details: [Product Link]
Contact seller: [Seller Contact]

Happy shopping!
LLM Marketplace Team
    `);

    // TODO: Integrate with actual email service (SendGrid, etc.)
    // await emailService.send({
    //   to: buyer.email,
    //   subject: `Found a match for your preference!`,
    //   template: 'buyer-match-notification',
    //   data: { match, product, buyer }
    // });

    // Update preference match tracking
    await pool.query(
      'UPDATE buyer_preferences SET last_matched_at = CURRENT_TIMESTAMP, match_count = match_count + 1 WHERE id = $1',
      [match.preference.id]
    );

    return true;

  } catch (error) {
    console.error('Error sending match notification:', error);
    return false;
  }
}

/**
 * Process matches and send notifications
 */
export async function processMatches(product: Product): Promise<void> {
  try {
    console.log(`🚀 Processing matches for new product: ${product.title}`);
    
    const matches = await findMatchingPreferences(product);
    
    if (matches.length === 0) {
      console.log(`😔 No matches found for product: ${product.title}`);
      return;
    }

    console.log(`🎉 Processing ${matches.length} matches...`);

    for (const match of matches) {
      const buyer = await getBuyerContact(match.preference.buyer_id);
      
      if (!buyer) {
        console.warn(`Skipping notification - buyer not found: ${match.preference.buyer_id}`);
        continue;
      }

      await sendMatchNotification(match, product, buyer);
      
      // Add small delay to avoid overwhelming email service
      await new Promise(resolve => setTimeout(resolve, 100));
    }

  } catch (error) {
    console.error('Error processing matches:', error);
  }
}