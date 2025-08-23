import { pool, connectDB } from '../config/database';

const addLocationColumns = async () => {
  try {
    await connectDB();
    
    console.log('Adding location columns to products table...');
    
    // Check if columns already exist
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products' 
      AND column_name IN ('mapbox_id', 'full_address', 'latitude', 'longitude', 'place_name', 'district', 'region')
      AND table_schema = 'public'
    `);

    if (columnCheck.rows.length > 0) {
      console.log('Location columns already exist');
      return;
    }

    // Add location columns for Mapbox integration
    await pool.query(`
      ALTER TABLE products 
      ADD COLUMN mapbox_id VARCHAR(255),
      ADD COLUMN full_address TEXT,
      ADD COLUMN latitude DECIMAL(10, 8),
      ADD COLUMN longitude DECIMAL(11, 8),
      ADD COLUMN place_name VARCHAR(255),
      ADD COLUMN district VARCHAR(100),
      ADD COLUMN region VARCHAR(100),
      ADD COLUMN country VARCHAR(50) DEFAULT 'Nepal'
    `);

    // Try to enable PostGIS extension, fall back to regular indexes if not available
    try {
      await pool.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
      
      // Create spatial index for efficient location queries
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_products_location 
        ON products USING GIST (ST_Point(longitude, latitude))
      `);
      
      console.log('Successfully added location columns with PostGIS spatial index');
    } catch (error) {
      console.log('PostGIS not available, creating regular indexes for location');
      
      // Create regular indexes for location queries
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_products_coordinates 
        ON products(latitude, longitude)
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      `);
      
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_products_place_name ON products(place_name);
        CREATE INDEX IF NOT EXISTS idx_products_district ON products(district);
        CREATE INDEX IF NOT EXISTS idx_products_region ON products(region);
      `);
      
      console.log('Successfully added location columns with regular indexes');
    }
    
  } catch (error) {
    console.error('Error adding location columns:', error);
    throw error;
  } finally {
    process.exit(0);
  }
};

if (require.main === module) {
  addLocationColumns();
}

export default addLocationColumns;