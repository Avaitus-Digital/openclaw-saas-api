import { Router, Response } from "express";
import { AuthRequest, authMiddleware } from "../middleware/auth";
import { getInstanceByUserId, updateInstanceUrl } from "../db/queries";
import { sendChatMessage, ChatMessage } from "../services/openclaw";
import { getServiceContainerName } from "../services/coolify";

const router = Router();

router.post(
  "/message",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { message, history } = req.body;

      if (!message) {
        res.status(400).json({ error: "Message is required" });
        return;
      }

      const instance = await getInstanceByUserId(userId);

      if (!instance) {
        res
          .status(404)
          .json({ error: "No OpenClaw instance found. Launch one first." });
        return;
      }

      if (instance.status !== "running") {
        res.status(400).json({
          error: `Instance is ${instance.status}. It must be running to chat.`,
        });
        return;
      }

      if (!instance.gateway_token) {
        res.status(503).json({
          error: "Instance is still being set up. Try again in a moment.",
        });
        return;
      }

      if (!instance.internal_url && instance.coolify_service_uuid) {
        const containerName = await getServiceContainerName(
          instance.coolify_service_uuid
        );
        if (containerName) {
          const url = `http://${containerName}:18789`;
          await updateInstanceUrl(userId, url);
          instance.internal_url = url;
        } else {
          res.status(503).json({
            error: "Instance is still being set up. Try again in a moment.",
          });
          return;
        }
      }

      const messages: ChatMessage[] = [];

      if (history && Array.isArray(history)) {
        for (const msg of history) {
          if (msg.role && msg.content) {
            messages.push({
              role: msg.role,
              content: msg.content,
            });
          }
        }
      }

      messages.push({ role: "user", content: message });

      const response = await sendChatMessage(
        instance.internal_url!,
        instance.gateway_token!,
        messages
      );

      const assistantMessage =
        response.choices[0]?.message?.content || "No response";

      res.json({
        message: assistantMessage,
        usage: response.usage,
      });
    } catch (err: any) {
      console.error("Chat error:", err?.response?.data || err?.message || err);

      if (err?.code === "ECONNREFUSED" || err?.code === "ETIMEDOUT") {
        res.status(503).json({
          error:
            "OpenClaw instance is not reachable. It may be starting up or stopped.",
        });
        return;
      }

      res.status(500).json({ error: "Failed to send message" });
    }
  }
);

export default router;
