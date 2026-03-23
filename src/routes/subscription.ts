import { Router, Response } from "express";
import { AuthRequest, authMiddleware } from "../middleware/auth";
import { config } from "../config";
import { getUserById, getSubscriptionByUserId } from "../db/queries";
import { createCheckoutSession, cancelSubscription } from "../services/stripe";

const router = Router();

router.post(
  "/create-checkout",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const user = await getUserById(userId);

      if (!user || !user.stripe_customer_id) {
        res.status(400).json({ error: "User not found or missing Stripe customer" });
        return;
      }

      const existingSub = await getSubscriptionByUserId(userId);
      if (existingSub && existingSub.status === "active") {
        res.status(409).json({ error: "You already have an active subscription" });
        return;
      }

      const { success_url, cancel_url } = req.body;

      const session = await createCheckoutSession(
        user.stripe_customer_id,
        config.stripe.priceId,
        success_url || "https://bullremodeling.com/success",
        cancel_url || "https://bullremodeling.com/cancel"
      );

      res.json({
        sessionId: session.id,
        url: session.url,
      });
    } catch (err) {
      console.error("Checkout error:", err);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  }
);

router.post(
  "/cancel",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const subscription = await getSubscriptionByUserId(userId);

      if (!subscription || !subscription.stripe_subscription_id) {
        res.status(404).json({ error: "No active subscription found" });
        return;
      }

      await cancelSubscription(subscription.stripe_subscription_id);

      res.json({ message: "Subscription cancelled" });
    } catch (err) {
      console.error("Cancel subscription error:", err);
      res.status(500).json({ error: "Failed to cancel subscription" });
    }
  }
);

router.get(
  "/status",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const subscription = await getSubscriptionByUserId(userId);

      if (!subscription) {
        res.json({ status: "none", subscription: null });
        return;
      }

      res.json({
        status: subscription.status,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          current_period_end: subscription.current_period_end,
        },
      });
    } catch (err) {
      console.error("Subscription status error:", err);
      res.status(500).json({ error: "Failed to get subscription status" });
    }
  }
);

export default router;
