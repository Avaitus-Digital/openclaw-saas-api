import { Pool } from "pg";
import { config } from "../config";

export const pool = new Pool({
  connectionString: config.database.url,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on("error", (err) => {
  console.error("Unexpected database error:", err);
});

export async function initDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        stripe_customer_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS instances (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        coolify_service_uuid VARCHAR(255),
        gateway_token VARCHAR(255),
        internal_url VARCHAR(255),
        status VARCHAR(50) DEFAULT 'provisioning',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        stripe_subscription_id VARCHAR(255),
        status VARCHAR(50) DEFAULT 'inactive',
        current_period_end TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("Database tables initialized");
  } finally {
    client.release();
  }
}
