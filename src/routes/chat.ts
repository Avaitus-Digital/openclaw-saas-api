import { Router, Response } from "express";
import { AuthRequest, authMiddleware } from "../middleware/auth";
import { getInstanceByUserId } from "../db/queries";
import { sendChatMessage } from "../services/openclaw";

const router = Router();

router.post(
  "/message",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { message } = req.body;

      if (!message) {
        res.status(400).json({ error: "Message is required" });
        return;
      }

      const instance = await getInstanceByUserId(userId);

      if (!instance) {
        res
          .status(404)
          .json({ error: "No ZeroClaw instance found. Launch one first." });
        return;
      }

      if (instance.status !== "running") {
        res.status(400).json({
          error: `Instance is ${instance.status}. It must be running to chat.`,
        });
        return;
      }

      if (!instance.internal_url) {
        res.status(503).json({
          error: "Instance is still being set up. Try again in a moment.",
        });
        return;
      }

      const response = await sendChatMessage(instance.internal_url, message);

      res.json({
        message: response.message,
      });
    } catch (err: any) {
      console.error("Chat error:", err?.message || err);

      if (err?.code === "ECONNREFUSED" || err?.code === "ETIMEDOUT") {
        res.status(503).json({
          error:
            "ZeroClaw instance is not reachable. It may be starting up or stopped.",
        });
        return;
      }

      res.status(500).json({ error: "Failed to send message" });
    }
  }
);

export default router;
