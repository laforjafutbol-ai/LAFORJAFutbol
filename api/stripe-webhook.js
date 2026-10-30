// api/stripe-webhook.js
// 1. Verifies Stripe signature
// 2. Confirms Firestore booking(s)
// 3. Sends confirmation email via /api/send-email

const Stripe = require("stripe");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const https = require("https");

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

module.exports.config = { api: { bodyParser: false } };

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function sendConfirmationEmail(booking) {
  const body = JSON.stringify({
    type: "group",
    booking: {
      name:          booking.name         || "",
      email:         booking.email        || "",
      dateLabel:     booking.dateLabel    || booking.dateKey || "",
      sessTime:      booking.sessTime     || booking.slotTime || "",
      skill:         booking.skill        || booking.packageName || "The Furnace",
      skillIcon:     booking.skillIcon    || "🔥",
      count:         booking.players      || booking.count || 1,
      total:         booking.total        || "",
      paymentMethod: "card",
    },
  });

  const host = process.env.VERCEL_URL
    ? process.env.VERCEL_URL
    : "laforjafutbol.com";
  const isLocal = host.includes("localhost");

  return new Promise((resolve, reject) => {
    const options = {
      hostname: isLocal ? "localhost" : host,
      path: "/api/send-email",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
      ...(isLocal ? { port: 3000 } : {}),
    };
    const req = https.request(options, (r) => {
      let d = "";
      r.on("data", (c) => (d += c));
      r.on("end", () => resolve(d));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
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

      // Send confirmation email using the first booking's data
      if (snap.docs.length > 0) {
        const firstDoc = snap.docs[0].data();
        await sendConfirmationEmail(firstDoc).catch((e) =>
          console.error("Confirmation email failed:", e.message)
        );
      }

    } else if (bookingRef) {
      const docRef = db.collection("bookings").doc(bookingRef);
      await docRef.update({
        status: "confirmed",
        paidAt: new Date().toISOString(),
        stripeSessionId: session.id,
      });
      console.log(`Confirmed booking ${bookingRef}`);

      // Send confirmation email
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        await sendConfirmationEmail(docSnap.data()).catch((e) =>
          console.error("Confirmation email failed:", e.message)
        );
      }

    } else {
      console.warn("No bookingRef or packageGroupId in metadata — session:", session.id);
    }
  } catch (err) {
    console.error("Firestore update failed:", err);
    return res.status(500).json({ error: "Firestore update failed" });
  }

  return res.status(200).json({ received: true });
};
