import Stripe from "stripe";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin once
if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
}
const db = getFirestore();

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const sig = req.headers["stripe-signature"];
  const rawBody = await getRawBody(req);

  let event;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const packageGroupId = session.metadata?.packageGroupId;
    const bookingRef = session.metadata?.bookingRef;

    try {
      if (packageGroupId) {
        // Confirm ALL bookings in this package group
        const snap = await db
          .collection("bookings")
          .where("packageGroupId", "==", packageGroupId)
          .get();
        const batch = db.batch();
        snap.docs.forEach((d) =>
          batch.update(d.ref, { status: "confirmed", paidAt: new Date().toISOString() })
        );
        await batch.commit();
        console.log(`Confirmed ${snap.docs.length} bookings for package group ${packageGroupId}`);
      } else if (bookingRef) {
        // Confirm single booking
        await db
          .collection("bookings")
          .doc(bookingRef)
          .update({ status: "confirmed", paidAt: new Date().toISOString() });
        console.log(`Confirmed single booking ${bookingRef}`);
      }
    } catch (err) {
      console.error("Firestore update error:", err);
      return res.status(500).json({ error: "Firestore update failed" });
    }
  }

  res.status(200).json({ received: true });
}
