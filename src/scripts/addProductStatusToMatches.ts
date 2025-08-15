import { Pool } from 'pg';
import { config } from 'dotenv';

config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function addProductStatusToMatches() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Add product_status column to buyer_preference_matches
    await client.query(`
      ALTER TABLE buyer_preference_matches 
      ADD COLUMN IF NOT EXISTS product_status VARCHAR(20) DEFAULT 'active'
      CHECK (product_status IN ('active', 'sold', 'expired', 'removed'))
    `);

    // Add product_status_updated_at column for tracking when status changed
    await client.query(`
      ALTER TABLE buyer_preference_matches 
      ADD COLUMN IF NOT EXISTS product_status_updated_at TIMESTAMP WITH TIME ZONE
    `);

    // Create index for efficient product_status queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_matches_product_status 
      ON buyer_preference_matches(product_status)
    `);

    // Create composite index for buyer queries with status
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_matches_buyer_product_status 
      ON buyer_preference_matches(buyer_id, product_status)
    `);

    // Update existing matches to sync with current product status
    await client.query(`
      UPDATE buyer_preference_matches 
      SET product_status = p.status,
          product_status_updated_at = CURRENT_TIMESTAMP
      FROM products p 
      WHERE buyer_preference_matches.product_id = p.id
      AND buyer_preference_matches.product_status != p.status
    `);

    await client.query('COMMIT');
    console.log('✅ product_status column added to buyer_preference_matches successfully');
    console.log('✅ Existing matches synchronized with current product status');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error adding product_status to matches table:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  addProductStatusToMatches()
    .then(() => {
      console.log('Product status migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Product status migration failed:', error);
      process.exit(1);
    });
}

export { addProductStatusToMatches };