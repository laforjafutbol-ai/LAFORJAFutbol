const Stripe = require("stripe");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    const { packageName, sessions, players, pricePerSession, total, bookingRef, email } = req.body;

    if (!total || total < 1) return res.status(400).json({ error: "Invalid amount" });
    if (total > 2000) return res.status(400).json({ error: "Amount exceeds maximum" });

    // Pricing breakdown shown clearly on Stripe checkout page
    const description = sessions > 1
      ? `${packageName} — ${sessions} sessions × ${players} player${players > 1 ? "s" : ""} @ $${pricePerSession}/session`
      : `Single Session — ${players} player${players > 1 ? "s" : ""} @ $${pricePerSession}/player`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: `La Forja Futbol — ${packageName || "Training Session"}`,
            description,
          },
          unit_amount: Math.round(total * 100),
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `https://laforjafutbol.com/?checkout=success&ref=${bookingRef || ""}`,
      cancel_url: `https://laforjafutbol.com/?checkout=cancel`,
      customer_email: email || undefined,
      metadata: {
        bookingRef: bookingRef || "",
        packageName: packageName || "",
        sessions: String(sessions || 1),
        players: String(players || 1),
        total: String(total),
      },
    });

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error("Checkout error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
