import { pool, connectDB } from '../config/database';

const addImageTables = async () => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    console.log('Adding image tables and updating products table...');

    // Create product_images table
    console.log('Creating product_images table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_images (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        s3_key VARCHAR(500) NOT NULL,
        s3_url VARCHAR(1000) NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        file_size INTEGER NOT NULL,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create index for better query performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_product_images_product_id 
      ON product_images(product_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_product_images_display_order 
      ON product_images(product_id, display_order);
    `);

    // Add preview_image_id column to products table
    console.log('Adding preview_image_id to products table...');
    await client.query(`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS preview_image_id UUID REFERENCES product_images(id) ON DELETE SET NULL;
    `);

    // Remove the old images array column if it exists and add image_count
    console.log('Updating products table structure...');
    await client.query(`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS image_count INTEGER DEFAULT 0;
    `);

    // Create trigger to update image_count automatically
    console.log('Creating trigger for image count...');
    await client.query(`
      CREATE OR REPLACE FUNCTION update_product_image_count()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          UPDATE products 
          SET image_count = image_count + 1 
          WHERE id = NEW.product_id;
          RETURN NEW;
        ELSIF TG_OP = 'DELETE' THEN
          UPDATE products 
          SET image_count = image_count - 1 
          WHERE id = OLD.product_id;
          RETURN OLD;
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS trigger_update_image_count ON product_images;
      CREATE TRIGGER trigger_update_image_count
        AFTER INSERT OR DELETE ON product_images
        FOR EACH ROW EXECUTE FUNCTION update_product_image_count();
    `);

    await client.query('COMMIT');
    console.log('Image tables and triggers created successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

const main = async () => {
  try {
    await connectDB();
    await addImageTables();
    console.log('Image database migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Image database migration failed:', error);
    process.exit(1);
  }
};

main();