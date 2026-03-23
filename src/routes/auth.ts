import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { createUser, getUserByEmail } from "../db/queries";
import { createCustomer } from "../services/stripe";

const router = Router();

router.post("/signup", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    if (password.length < 6) {
      res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
      return;
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    let stripeCustomerId: string | undefined;
    try {
      const stripeCustomer = await createCustomer(email);
      stripeCustomerId = stripeCustomer.id;
    } catch {
      console.warn("Stripe not configured, skipping customer creation");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createUser(email, passwordHash, stripeCustomerId);

    const token = jwt.sign({ userId: user.id }, config.jwt.secret, {
      expiresIn: "7d" as any,
    });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        stripeCustomerId: user.stripe_customer_id,
      },
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const user = await getUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = jwt.sign({ userId: user.id }, config.jwt.secret, {
      expiresIn: "7d" as any,
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        stripeCustomerId: user.stripe_customer_id,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
