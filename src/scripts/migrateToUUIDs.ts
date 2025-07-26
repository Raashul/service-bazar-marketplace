import { pool, connectDB } from '../config/database';

const migrateToUUIDs = async () => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    console.log('Starting UUID migration...');

    // Drop existing tables in reverse dependency order
    console.log('Dropping existing tables...');
    await client.query('DROP TABLE IF EXISTS messages CASCADE');
    await client.query('DROP TABLE IF EXISTS products CASCADE');
    await client.query('DROP TABLE IF EXISTS refresh_tokens CASCADE');
    await client.query('DROP TABLE IF EXISTS users CASCADE');

    // Enable UUID extension
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // Create users table with UUID
    console.log('Creating users table with UUID...');
    await client.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        phone VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create refresh_tokens table with UUID foreign key
    console.log('Creating refresh_tokens table...');
    await client.query(`
      CREATE TABLE refresh_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        token_id VARCHAR(64) UNIQUE NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_revoked BOOLEAN DEFAULT FALSE
      );
    `);

    // Create products table with UUID
    console.log('Creating products table with UUID...');
    await client.query(`
      CREATE TABLE products (
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
        images TEXT[], -- Array of image URLs
        tags TEXT[], -- Array of tags
        is_negotiable BOOLEAN DEFAULT true,
        expires_at TIMESTAMP NOT NULL,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'sold', 'expired', 'removed')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create messages table with UUID foreign keys
    console.log('Creating messages table with UUID foreign keys...');
    await client.query(`
      CREATE TABLE messages (
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
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
        responded_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(product_id, buyer_id, seller_id) -- One initial message per buyer-seller-product combo
      );
    `);

    await client.query('COMMIT');
    console.log('UUID migration completed successfully!');

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
    await migrateToUUIDs();
    console.log('Database migration to UUIDs completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Database migration failed:', error);
    process.exit(1);
  }
};

main();