import { pool, connectDB } from '../config/database';

const addListingTypeColumn = async () => {
  try {
    await connectDB();
    
    console.log('Adding listing_type column to products table...');
    
    // Check if column already exists
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products' 
      AND column_name = 'listing_type'
      AND table_schema = 'public'
    `);

    if (columnCheck.rows.length > 0) {
      console.log('listing_type column already exists');
      return;
    }

    // Add the listing_type column
    await pool.query(`
      ALTER TABLE products 
      ADD COLUMN listing_type VARCHAR(20) DEFAULT 'product' 
      CHECK (listing_type IN ('product', 'service'))
    `);

    // Update any existing records to have 'product' as default
    await pool.query(`
      UPDATE products 
      SET listing_type = 'product' 
      WHERE listing_type IS NULL
    `);

    console.log('Successfully added listing_type column');
    
  } catch (error) {
    console.error('Error adding listing_type column:', error);
    throw error;
  } finally {
    process.exit(0);
  }
};

if (require.main === module) {
  addListingTypeColumn();
}

export default addListingTypeColumn;