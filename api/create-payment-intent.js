const Stripe = require("stripe");

// Test mode secret key
const stripe = Stripe("sk_test_51TW0MzFU9deEKlhCQdCpU6zZeeSKKffjLFJVLKLcwaU9N0dNpwdfLk3e7OaglckppivQ3bsFgJ0kJGlLzQKBC45i00TPqsBM3S");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { amount, metadata } = req.body;

    if (!amount || amount < 1) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // cents
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      metadata: metadata || {},
      description: "La Forja Futbol — " + (metadata?.sessionType || "Training Session"),
    });

    return res.status(200).json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id });
  } catch (err) {
    console.error("Stripe error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
