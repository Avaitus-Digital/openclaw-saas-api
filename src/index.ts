import express from "express";
import cors from "cors";
import { config } from "./config";
import { initDatabase } from "./db";
import authRoutes from "./routes/auth";
import instanceRoutes from "./routes/instance";
import chatRoutes from "./routes/chat";
import subscriptionRoutes from "./routes/subscription";
import webhookRoutes from "./routes/webhooks";

const app = express();

app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  webhookRoutes
);

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/instance", instanceRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/subscription", subscriptionRoutes);

async function start() {
  try {
    await initDatabase();
    console.log("Database connected and initialized");

    app.listen(config.port, () => {
      console.log(`OpenClaw SaaS API running on port ${config.port}`);
      console.log(`Environment: ${config.nodeEnv}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

start();
