import { pool } from "./index";

export interface User {
  id: number;
  email: string;
  password_hash: string;
  stripe_customer_id: string | null;
  created_at: Date;
}

export interface Instance {
  id: number;
  user_id: number;
  coolify_service_uuid: string | null;
  gateway_token: string | null;
  internal_url: string | null;
  status: string;
  created_at: Date;
}

export interface Subscription {
  id: number;
  user_id: number;
  stripe_subscription_id: string | null;
  status: string;
  current_period_end: Date | null;
  created_at: Date;
}

export async function createUser(
  email: string,
  passwordHash: string,
  stripeCustomerId?: string
): Promise<User> {
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, stripe_customer_id)
     VALUES ($1, $2, $3) RETURNING *`,
    [email, passwordHash, stripeCustomerId || null]
  );
  return result.rows[0];
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [
    email,
  ]);
  return result.rows[0] || null;
}

export async function getUserById(id: number): Promise<User | null> {
  const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  return result.rows[0] || null;
}

export async function updateUserStripeCustomerId(
  userId: number,
  stripeCustomerId: string
): Promise<void> {
  await pool.query("UPDATE users SET stripe_customer_id = $1 WHERE id = $2", [
    stripeCustomerId,
    userId,
  ]);
}

export async function createInstance(
  userId: number,
  coolifyServiceUuid: string,
  gatewayToken: string
): Promise<Instance> {
  const result = await pool.query(
    `INSERT INTO instances (user_id, coolify_service_uuid, gateway_token, status)
     VALUES ($1, $2, $3, 'provisioning')
     ON CONFLICT (user_id) DO UPDATE SET
       coolify_service_uuid = $2,
       gateway_token = $3,
       status = 'provisioning'
     RETURNING *`,
    [userId, coolifyServiceUuid, gatewayToken]
  );
  return result.rows[0];
}

export async function getInstanceByUserId(
  userId: number
): Promise<Instance | null> {
  const result = await pool.query(
    "SELECT * FROM instances WHERE user_id = $1",
    [userId]
  );
  return result.rows[0] || null;
}

export async function updateInstanceStatus(
  userId: number,
  status: string
): Promise<void> {
  await pool.query("UPDATE instances SET status = $1 WHERE user_id = $2", [
    status,
    userId,
  ]);
}

export async function updateInstanceUrl(
  userId: number,
  internalUrl: string
): Promise<void> {
  await pool.query(
    "UPDATE instances SET internal_url = $1, status = 'running' WHERE user_id = $2",
    [internalUrl, userId]
  );
}

export async function deleteInstance(userId: number): Promise<void> {
  await pool.query("DELETE FROM instances WHERE user_id = $1", [userId]);
}

export async function createSubscription(
  userId: number,
  stripeSubscriptionId: string,
  status: string,
  currentPeriodEnd: Date
): Promise<Subscription> {
  const result = await pool.query(
    `INSERT INTO subscriptions (user_id, stripe_subscription_id, status, current_period_end)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE SET
       stripe_subscription_id = $2,
       status = $3,
       current_period_end = $4
     RETURNING *`,
    [userId, stripeSubscriptionId, status, currentPeriodEnd]
  );
  return result.rows[0];
}

export async function getSubscriptionByUserId(
  userId: number
): Promise<Subscription | null> {
  const result = await pool.query(
    "SELECT * FROM subscriptions WHERE user_id = $1",
    [userId]
  );
  return result.rows[0] || null;
}

export async function updateSubscriptionStatus(
  stripeSubscriptionId: string,
  status: string
): Promise<void> {
  await pool.query(
    "UPDATE subscriptions SET status = $1 WHERE stripe_subscription_id = $2",
    [status, stripeSubscriptionId]
  );
}

export async function getUserByStripeCustomerId(
  stripeCustomerId: string
): Promise<User | null> {
  const result = await pool.query(
    "SELECT * FROM users WHERE stripe_customer_id = $1",
    [stripeCustomerId]
  );
  return result.rows[0] || null;
}
