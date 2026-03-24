import { Router, Request, Response } from "express";
import { constructWebhookEvent } from "../services/stripe";
import {
  getUserByStripeCustomerId,
  createSubscription,
  updateSubscriptionStatus,
  getInstanceByUserId,
  deleteInstance,
} from "../db/queries";
import { deleteService } from "../services/coolify";

const router = Router();

router.post("/stripe", async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;

  if (!sig) {
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }

  try {
    const event = constructWebhookEvent(req.body, sig);

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as any;
        const customerId = subscription.customer as string;
        const user = await getUserByStripeCustomerId(customerId);

        if (user) {
          await createSubscription(
            user.id,
            subscription.id,
            subscription.status,
            new Date(subscription.current_period_end * 1000)
          );
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        await updateSubscriptionStatus(subscription.id, "cancelled");

        const customerId = subscription.customer as string;
        const user = await getUserByStripeCustomerId(customerId);

        if (user) {
          const instance = await getInstanceByUserId(user.id);
          if (instance?.coolify_service_uuid) {
            try {
              await deleteService(instance.coolify_service_uuid);
              await deleteInstance(user.id);
              console.log(
                `Destroyed OpenClaw instance for user ${user.id} after subscription cancellation`
              );
            } catch (err) {
              console.error(
                `Failed to destroy instance for user ${user.id}:`,
                err
              );
            }
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as any;
        const customerId = invoice.customer as string;
        const user = await getUserByStripeCustomerId(customerId);
        if (user) {
          console.warn(`Payment failed for user ${user.id}`);
        }
        break;
      }

      default:
        console.log(`Unhandled webhook event: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error("Webhook error:", err?.message);
    res.status(400).json({ error: `Webhook error: ${err?.message}` });
  }
});

export default router;
