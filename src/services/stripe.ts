import Stripe from "stripe";
import { config } from "../config";

export const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: "2026-02-25.clover",
});

export async function createCustomer(
  email: string
): Promise<Stripe.Customer> {
  return stripe.customers.create({ email });
}

export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
}

export async function cancelSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.cancel(subscriptionId);
}

export function constructWebhookEvent(
  body: Buffer,
  signature: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    body,
    signature,
    config.stripe.webhookSecret
  );
}
