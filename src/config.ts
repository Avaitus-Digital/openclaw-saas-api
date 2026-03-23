import dotenv from "dotenv";
dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",

  database: {
    url: required("DATABASE_URL"),
  },

  jwt: {
    secret: required("JWT_SECRET"),
    expiresIn: "7d",
  },

  coolify: {
    url: required("COOLIFY_URL"),
    apiToken: required("COOLIFY_API_TOKEN"),
    projectUuid: required("COOLIFY_PROJECT_UUID"),
    environmentUuid: required("COOLIFY_ENVIRONMENT_UUID"),
    serverUuid: required("COOLIFY_SERVER_UUID"),
  },

  openrouter: {
    apiKey: required("OPENROUTER_API_KEY"),
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || "",
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    priceId: process.env.STRIPE_PRICE_ID || "",
  },
};
