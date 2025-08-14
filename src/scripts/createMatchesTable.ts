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

async function createMatchesTable() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Create buyer_preference_matches table
    await client.query(`
      CREATE TABLE IF NOT EXISTS buyer_preference_matches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        preference_id UUID NOT NULL REFERENCES buyer_preferences(id) ON DELETE CASCADE,
        buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        
        -- Match scoring
        match_score INTEGER NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
        match_reason TEXT NOT NULL,
        
        -- Product snapshot (in case product gets deleted/sold)
        product_snapshot JSONB NOT NULL,
        
        -- Match status
        status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'viewed', 'interested', 'contacted', 'dismissed')),
        
        -- Timestamps
        matched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        viewed_at TIMESTAMP WITH TIME ZONE,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        
        -- Prevent duplicate matches
        UNIQUE(preference_id, product_id)
      )
    `);

    // Create indexes for efficient querying
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_matches_buyer_id 
      ON buyer_preference_matches(buyer_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_matches_preference_id 
      ON buyer_preference_matches(preference_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_matches_product_id 
      ON buyer_preference_matches(product_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_matches_status 
      ON buyer_preference_matches(status)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_matches_score 
      ON buyer_preference_matches(match_score DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_matches_matched_at 
      ON buyer_preference_matches(matched_at DESC)
    `);

    // Create composite indexes for common queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_matches_buyer_status_score 
      ON buyer_preference_matches(buyer_id, status, match_score DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_matches_preference_score 
      ON buyer_preference_matches(preference_id, match_score DESC)
    `);

    await client.query('COMMIT');
    console.log('✅ buyer_preference_matches table created successfully with indexes');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating buyer_preference_matches table:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  createMatchesTable()
    .then(() => {
      console.log('Match table setup completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Match table setup failed:', error);
      process.exit(1);
    });
}

export { createMatchesTable };