// api/webhook.js
// Listens for checkout.session.completed → confirms Firestore bookings
//
// Vercel env vars needed:
//   STRIPE_SECRET_KEY       sk_live_...
//   STRIPE_WEBHOOK_SECRET   whsec_...  (from Stripe Dashboard → Webhooks)
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY    (paste the full key including -----BEGIN...-----)

const Stripe = require("stripe");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// Reuse Firebase Admin across warm Vercel invocations
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}
const db = getFirestore();

// IMPORTANT: raw body required for Stripe signature verification
module.exports.config = { api: { bodyParser: false } };

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Stripe signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type !== "checkout.session.completed") {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;
  const { bookingRef, packageGroupId } = session.metadata || {};

  try {
    if (packageGroupId) {
      // Package — confirm ALL bookings tied to this group
      const snap = await db.collection("bookings")
        .where("packageGroupId", "==", packageGroupId)
        .get();

      const batch = db.batch();
      snap.docs.forEach((d) =>
        batch.update(d.ref, {
          status: "confirmed",
          paidAt: new Date().toISOString(),
          stripeSessionId: session.id,
        })
      );
      await batch.commit();
      console.log(`Confirmed ${snap.size} bookings — package group ${packageGroupId}`);

    } else if (bookingRef) {
      // Single session
      await db.collection("bookings").doc(bookingRef).update({
        status: "confirmed",
        paidAt: new Date().toISOString(),
        stripeSessionId: session.id,
      });
      console.log(`Confirmed booking ${bookingRef}`);

    } else {
      console.warn("No bookingRef or packageGroupId in metadata — session:", session.id);
    }
  } catch (err) {
    console.error("Firestore update failed:", err);
    // Non-200 tells Stripe to retry
    return res.status(500).json({ error: "Firestore update failed" });
  }

  return res.status(200).json({ received: true });
};
