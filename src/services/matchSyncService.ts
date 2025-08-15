import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

export type ProductStatus = 'active' | 'sold' | 'expired' | 'removed';

/**
 * Update related matches when a product status changes
 */
export async function updateRelatedMatches(
  productId: string, 
  newStatus: ProductStatus,
  reason?: string
): Promise<number> {
  try {
    console.log(`🔄 Updating matches for product ${productId} to status: ${newStatus}`);

    const updateQuery = `
      UPDATE buyer_preference_matches 
      SET product_status = $1, 
          product_status_updated_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE product_id = $2 AND product_status != $1
      RETURNING id, buyer_id, preference_id
    `;

    const result = await pool.query(updateQuery, [newStatus, productId]);
    const updatedMatches = result.rows;

    console.log(`✅ Updated ${updatedMatches.length} matches for product ${productId}`);

    // Optionally log which matches were affected for debugging
    if (updatedMatches.length > 0) {
      console.log(`📊 Affected matches:`, updatedMatches.map(m => ({
        match_id: m.id,
        buyer_id: m.buyer_id,
        preference_id: m.preference_id
      })));
    }

    return updatedMatches.length;

  } catch (error) {
    console.error('❌ Error updating related matches:', error);
    throw error;
  }
}

/**
 * Get availability info for UI display
 */
export function getAvailabilityInfo(productStatus: ProductStatus): {
  status: ProductStatus;
  message: string;
  alternative_actions: string[];
} {
  const availabilityMap = {
    active: {
      status: 'active' as ProductStatus,
      message: 'This item is still available',
      alternative_actions: ['Contact seller', 'View product details']
    },
    sold: {
      status: 'sold' as ProductStatus,
      message: 'This item has been sold',
      alternative_actions: [
        'Contact seller for similar items',
        'Find similar products',
        'Save search for future matches'
      ]
    },
    expired: {
      status: 'expired' as ProductStatus,
      message: 'This listing has expired',
      alternative_actions: [
        'Contact seller to renew listing',
        'Find similar active products',
        'Set up saved search'
      ]
    },
    removed: {
      status: 'removed' as ProductStatus,
      message: 'This item was removed by the seller',
      alternative_actions: [
        'Find similar products',
        'Browse other sellers',
        'Adjust your preferences'
      ]
    }
  };

  return availabilityMap[productStatus];
}

/**
 * Batch update expired products and their matches
 */
export async function markExpiredProducts(): Promise<void> {
  try {
    console.log('🕐 Checking for expired products...');

    // Find and update expired products
    const expiredQuery = `
      UPDATE products 
      SET status = 'expired', updated_at = CURRENT_TIMESTAMP
      WHERE expires_at < CURRENT_TIMESTAMP 
      AND status = 'active'
      RETURNING id, title
    `;

    const expiredResult = await pool.query(expiredQuery);
    const expiredProducts = expiredResult.rows;

    console.log(`📅 Found ${expiredProducts.length} expired products`);

    // Update matches for each expired product
    let totalMatchesUpdated = 0;
    for (const product of expiredProducts) {
      const matchesUpdated = await updateRelatedMatches(product.id, 'expired');
      totalMatchesUpdated += matchesUpdated;
      
      console.log(`⏰ Expired: "${product.title}" (${matchesUpdated} matches updated)`);
    }

    console.log(`✅ Expired ${expiredProducts.length} products and updated ${totalMatchesUpdated} matches`);

  } catch (error) {
    console.error('❌ Error marking expired products:', error);
    throw error;
  }
}

/**
 * Sync all matches with current product status (cleanup/repair function)
 */
export async function syncAllMatches(): Promise<void> {
  try {
    console.log('🔄 Syncing all matches with current product status...');

    const syncQuery = `
      UPDATE buyer_preference_matches 
      SET product_status = p.status,
          product_status_updated_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      FROM products p 
      WHERE buyer_preference_matches.product_id = p.id
      AND buyer_preference_matches.product_status != p.status
      RETURNING buyer_preference_matches.id, buyer_preference_matches.product_id, p.status
    `;

    const result = await pool.query(syncQuery);
    const syncedMatches = result.rows;

    console.log(`✅ Synchronized ${syncedMatches.length} matches with current product status`);

    // Group by status for reporting
    const statusCounts = syncedMatches.reduce((acc, match) => {
      acc[match.status] = (acc[match.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('📊 Status changes:', statusCounts);

  } catch (error) {
    console.error('❌ Error syncing matches:', error);
    throw error;
  }
}

/**
 * Get match statistics by product status
 */
export async function getMatchStatsByStatus(buyerId: string): Promise<Record<string, number>> {
  try {
    const statsQuery = `
      SELECT 
        product_status,
        COUNT(*) as count
      FROM buyer_preference_matches 
      WHERE buyer_id = $1
      GROUP BY product_status
    `;

    const result = await pool.query(statsQuery, [buyerId]);
    
    const stats = result.rows.reduce((acc, row) => {
      acc[row.product_status] = parseInt(row.count);
      return acc;
    }, {} as Record<string, number>);

    return {
      active: stats.active || 0,
      sold: stats.sold || 0,
      expired: stats.expired || 0,
      removed: stats.removed || 0
    };

  } catch (error) {
    console.error('❌ Error getting match stats by status:', error);
    return { active: 0, sold: 0, expired: 0, removed: 0 };
  }
}