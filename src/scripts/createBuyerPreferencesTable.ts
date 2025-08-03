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

async function createBuyerPreferencesTable() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Create buyer_preferences table
    await client.query(`
      CREATE TABLE IF NOT EXISTS buyer_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        preference_text TEXT NOT NULL,
        extracted_keywords TEXT[],
        extracted_category VARCHAR(255),
        extracted_subcategory VARCHAR(255),
        extracted_subsubcategory VARCHAR(255),
        min_price DECIMAL(12, 2),
        max_price DECIMAL(12, 2),
        currency VARCHAR(10) DEFAULT 'NPR',
        listing_type VARCHAR(20) CHECK (listing_type IN ('product', 'service')),
        location_data JSONB,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'paused')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_matched_at TIMESTAMP WITH TIME ZONE,
        match_count INTEGER DEFAULT 0
      )
    `);

    // Create indexes for efficient querying
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_buyer_preferences_buyer_id 
      ON buyer_preferences(buyer_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_buyer_preferences_status 
      ON buyer_preferences(status)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_buyer_preferences_category 
      ON buyer_preferences(extracted_category, extracted_subcategory)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_buyer_preferences_price 
      ON buyer_preferences(min_price, max_price)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_buyer_preferences_listing_type 
      ON buyer_preferences(listing_type)
    `);

    // Create GIN index for location_data JSONB queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_buyer_preferences_location_data 
      ON buyer_preferences USING GIN(location_data)
    `);

    // Create GIN index for keyword array searches
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_buyer_preferences_keywords 
      ON buyer_preferences USING GIN(extracted_keywords)
    `);

    await client.query('COMMIT');
    console.log('✅ buyer_preferences table created successfully with indexes');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating buyer_preferences table:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  createBuyerPreferencesTable()
    .then(() => {
      console.log('Database setup completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Database setup failed:', error);
      process.exit(1);
    });
}

export { createBuyerPreferencesTable };