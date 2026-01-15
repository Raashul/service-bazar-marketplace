import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

export const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || "5432"),
  //temporary for supabase (test) db integration
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

export const connectDB = async () => {
  try {
    await pool.connect();
    console.log("Connected to PostgreSQL database");
  } catch (error) {
    console.error("Database connection error:", error);
    process.exit(1);
  }
};
