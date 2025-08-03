"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../config/database");
const createUsersTable = async () => {
    // Enable UUID extension
    await database_1.pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    const createTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      phone VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
    try {
        await database_1.pool.query(createTableQuery);
        console.log('Users table created successfully');
    }
    catch (error) {
        console.error('Error creating users table:', error);
        throw error;
    }
};
const createRefreshTokensTable = async () => {
    const createTableQuery = `
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      token_id VARCHAR(64) UNIQUE NOT NULL,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_revoked BOOLEAN DEFAULT FALSE
    );
  `;
    try {
        await database_1.pool.query(createTableQuery);
        console.log('Refresh tokens table created successfully');
    }
    catch (error) {
        console.error('Error creating refresh tokens table:', error);
        throw error;
    }
};
const createProductsTable = async () => {
    // Skip PostGIS for now - use simple lat/lng columns
    // await pool.query('CREATE EXTENSION IF NOT EXISTS postgis');
    const createTableQuery = `
    CREATE TABLE IF NOT EXISTS products (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      currency VARCHAR(3) DEFAULT 'USD',
      category VARCHAR(100) NOT NULL,
      subcategory VARCHAR(100) DEFAULT '',
      subsubcategory VARCHAR(100) DEFAULT '',
      condition VARCHAR(20) CHECK (condition IN ('new', 'like_new', 'good', 'fair', 'poor')),
      location VARCHAR(255) NOT NULL,
      listing_type VARCHAR(20) DEFAULT 'product' CHECK (listing_type IN ('product', 'service')),
      enriched_tags TEXT[],
      is_negotiable BOOLEAN DEFAULT true,
      expires_at TIMESTAMP NOT NULL,
      status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'sold', 'expired', 'removed')),
      preview_image_id UUID,
      image_count INTEGER DEFAULT 0,
      -- Location fields for Mapbox integration
      mapbox_id VARCHAR(255),
      full_address TEXT,
      latitude DECIMAL(10, 8),
      longitude DECIMAL(11, 8),
      place_name VARCHAR(255),
      district VARCHAR(100),
      region VARCHAR(100),
      country VARCHAR(50) DEFAULT 'Nepal',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
    try {
        await database_1.pool.query(createTableQuery);
        // Create regular indexes for location queries (without PostGIS)
        await database_1.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_products_coordinates 
      ON products(latitude, longitude)
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    `);
        // Create regular indexes for location fields
        await database_1.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_products_place_name ON products(place_name);
      CREATE INDEX IF NOT EXISTS idx_products_district ON products(district);
      CREATE INDEX IF NOT EXISTS idx_products_region ON products(region);
    `);
        console.log('Products table created successfully with location support');
    }
    catch (error) {
        console.error('Error creating products table:', error);
        throw error;
    }
};
const createMessagesTable = async () => {
    const createTableQuery = `
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      is_initial_message BOOLEAN DEFAULT true,
      email_sent BOOLEAN DEFAULT false,
      email_error TEXT,
      email_error_type VARCHAR(50),
      email_attempts INTEGER DEFAULT 0,
      email_message_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(product_id, buyer_id, seller_id) -- One initial message per buyer-seller-product combo
    );
  `;
    try {
        await database_1.pool.query(createTableQuery);
        console.log('Messages table created successfully');
    }
    catch (error) {
        console.error('Error creating messages table:', error);
        throw error;
    }
};
const createProductImagesTable = async () => {
    const createTableQuery = `
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
  `;
    try {
        await database_1.pool.query(createTableQuery);
        // Create indexes
        await database_1.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_product_images_product_id 
      ON product_images(product_id);
    `);
        await database_1.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_product_images_display_order 
      ON product_images(product_id, display_order);
    `);
        console.log('Product images table created successfully');
    }
    catch (error) {
        console.error('Error creating product images table:', error);
        throw error;
    }
};
const addForeignKeyConstraintAndTriggers = async () => {
    try {
        // Add foreign key constraint for preview_image_id
        await database_1.pool.query(`
      ALTER TABLE products 
      ADD CONSTRAINT fk_products_preview_image_id 
      FOREIGN KEY (preview_image_id) REFERENCES product_images(id) ON DELETE SET NULL;
    `);
        // Create function to update image count
        await database_1.pool.query(`
      CREATE OR REPLACE FUNCTION update_product_image_count() 
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          UPDATE products SET image_count = (
            SELECT COUNT(*) FROM product_images WHERE product_id = NEW.product_id
          ) WHERE id = NEW.product_id;
          RETURN NEW;
        ELSIF TG_OP = 'DELETE' THEN
          UPDATE products SET image_count = (
            SELECT COUNT(*) FROM product_images WHERE product_id = OLD.product_id
          ) WHERE id = OLD.product_id;
          RETURN OLD;
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);
        // Create trigger
        await database_1.pool.query(`
      DROP TRIGGER IF EXISTS trigger_update_image_count ON product_images;
      CREATE TRIGGER trigger_update_image_count
        AFTER INSERT OR DELETE ON product_images
        FOR EACH ROW EXECUTE FUNCTION update_product_image_count();
    `);
        console.log('Foreign key constraints and triggers created successfully');
    }
    catch (error) {
        console.error('Error creating constraints and triggers:', error);
        throw error;
    }
};
const main = async () => {
    try {
        await (0, database_1.connectDB)();
        await createUsersTable();
        await createRefreshTokensTable();
        await createProductsTable();
        await createMessagesTable();
        await createProductImagesTable();
        await addForeignKeyConstraintAndTriggers();
        console.log('Database setup completed successfully');
        process.exit(0);
    }
    catch (error) {
        console.error('Database setup failed:', error);
        process.exit(1);
    }
};
main();
//# sourceMappingURL=createTables.js.map