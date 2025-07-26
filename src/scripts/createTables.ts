import { pool, connectDB } from '../config/database';

const createUsersTable = async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      phone VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await pool.query(createTableQuery);
    console.log('Users table created successfully');
  } catch (error) {
    console.error('Error creating users table:', error);
    throw error;
  }
};

const createRefreshTokensTable = async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id SERIAL PRIMARY KEY,
      token_id VARCHAR(64) UNIQUE NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_revoked BOOLEAN DEFAULT FALSE
    );
  `;

  try {
    await pool.query(createTableQuery);
    console.log('Refresh tokens table created successfully');
  } catch (error) {
    console.error('Error creating refresh tokens table:', error);
    throw error;
  }
};

const createProductsTable = async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  `;

  try {
    await pool.query(createTableQuery);
    console.log('Products table created successfully');
  } catch (error) {
    console.error('Error creating products table:', error);
    throw error;
  }
};

const createMessagesTable = async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
    await pool.query(createTableQuery);
    console.log('Messages table created successfully');
  } catch (error) {
    console.error('Error creating messages table:', error);
    throw error;
  }
};

const main = async () => {
  try {
    await connectDB();
    await createUsersTable();
    await createRefreshTokensTable();
    await createProductsTable();
    await createMessagesTable();
    console.log('Database setup completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Database setup failed:', error);
    process.exit(1);
  }
};

main();