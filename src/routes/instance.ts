import { Router, Response } from "express";
import { AuthRequest, authMiddleware } from "../middleware/auth";
import {
  createInstance,
  getInstanceByUserId,
  updateInstanceStatus,
  deleteInstance,
} from "../db/queries";
import {
  createOpenClawService,
  deleteOpenClawService,
  stopOpenClawService,
  startOpenClawService,
  restartOpenClawService,
  getServiceStatus,
} from "../services/coolify";

const router = Router();

router.post(
  "/launch",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;

      const existing = await getInstanceByUserId(userId);
      if (existing && existing.status !== "destroyed") {
        res.status(409).json({
          error: "You already have an OpenClaw instance",
          instance: {
            status: existing.status,
            created_at: existing.created_at,
          },
        });
        return;
      }

      const { serviceUuid, gatewayToken } =
        await createOpenClawService(userId);

      const instance = await createInstance(userId, serviceUuid, gatewayToken);

      res.status(201).json({
        message: "OpenClaw instance is being provisioned",
        instance: {
          id: instance.id,
          status: instance.status,
          created_at: instance.created_at,
        },
      });
    } catch (err) {
      console.error("Launch error:", err);
      res.status(500).json({ error: "Failed to launch OpenClaw instance" });
    }
  }
);

router.get(
  "/status",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const instance = await getInstanceByUserId(userId);

      if (!instance) {
        res.json({ status: "not_created", instance: null });
        return;
      }

      if (
        instance.coolify_service_uuid &&
        instance.status === "provisioning"
      ) {
        const coolifyStatus = await getServiceStatus(
          instance.coolify_service_uuid
        );
        if (
          coolifyStatus.includes("running") ||
          coolifyStatus.includes("healthy")
        ) {
          await updateInstanceStatus(userId, "running");
          instance.status = "running";
        }
      }

      res.json({
        status: instance.status,
        instance: {
          id: instance.id,
          status: instance.status,
          created_at: instance.created_at,
        },
      });
    } catch (err) {
      console.error("Status error:", err);
      res.status(500).json({ error: "Failed to get instance status" });
    }
  }
);

router.post(
  "/stop",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const instance = await getInstanceByUserId(userId);

      if (!instance || !instance.coolify_service_uuid) {
        res.status(404).json({ error: "No active instance found" });
        return;
      }

      await stopOpenClawService(instance.coolify_service_uuid);
      await updateInstanceStatus(userId, "stopped");

      res.json({ message: "Instance stopped", status: "stopped" });
    } catch (err) {
      console.error("Stop error:", err);
      res.status(500).json({ error: "Failed to stop instance" });
    }
  }
);

router.post(
  "/start",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const instance = await getInstanceByUserId(userId);

      if (!instance || !instance.coolify_service_uuid) {
        res.status(404).json({ error: "No instance found" });
        return;
      }

      await startOpenClawService(instance.coolify_service_uuid);
      await updateInstanceStatus(userId, "running");

      res.json({ message: "Instance started", status: "running" });
    } catch (err) {
      console.error("Start error:", err);
      res.status(500).json({ error: "Failed to start instance" });
    }
  }
);

router.post(
  "/restart",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const instance = await getInstanceByUserId(userId);

      if (!instance || !instance.coolify_service_uuid) {
        res.status(404).json({ error: "No active instance found" });
        return;
      }

      await restartOpenClawService(instance.coolify_service_uuid);
      await updateInstanceStatus(userId, "running");

      res.json({ message: "Instance restarted", status: "running" });
    } catch (err) {
      console.error("Restart error:", err);
      res.status(500).json({ error: "Failed to restart instance" });
    }
  }
);

router.delete(
  "/destroy",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const instance = await getInstanceByUserId(userId);

      if (!instance || !instance.coolify_service_uuid) {
        res.status(404).json({ error: "No instance found" });
        return;
      }

      await deleteOpenClawService(instance.coolify_service_uuid);
      await deleteInstance(userId);

      res.json({ message: "Instance destroyed" });
    } catch (err) {
      console.error("Destroy error:", err);
      res.status(500).json({ error: "Failed to destroy instance" });
    }
  }
);

export default router;
